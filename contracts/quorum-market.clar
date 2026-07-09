;; ============================================================
;; Quorum Market Contract
;; Stacks testnet — Clarity v1
;;
;; Two actors:
;;   USER  — stakes USDCx on YES or NO
;;   AGENT — resolves market, triggers winner payouts
;;
;; Flow per market:
;;   1. User calls (stake market-id side amount)
;;      → USDCx transferred from user → this contract
;;      → stake recorded
;;   2. Agent calls (resolve market-id winning-side resolution-price)
;;      → marks winner side
;;      → loops over winner stakes, sends each winner their pro-rata payout
;;      → 5% protocol fee stays in contract (agent can sweep later)
;; ============================================================

;; ── SIP-010 USDCx trait ─────────────────────────────────────
(define-trait sip010-trait
  (
    (transfer (uint principal principal (optional (buff 34))) (response bool uint))
    (get-balance (principal) (response uint uint))
  )
)

;; ── Constants ───────────────────────────────────────────────
(define-constant CONTRACT-OWNER tx-sender)
(define-constant PROTOCOL-FEE-BPS u500)        ;; 5% = 500 basis points
(define-constant BPS-BASE u10000)
(define-constant ERR-NOT-OWNER          (err u100))
(define-constant ERR-MARKET-NOT-OPEN    (err u101))
(define-constant ERR-MARKET-NOT-FOUND   (err u102))
(define-constant ERR-ALREADY-RESOLVED   (err u103))
(define-constant ERR-INVALID-SIDE       (err u104))
(define-constant ERR-ZERO-AMOUNT        (err u105))
(define-constant ERR-TRANSFER-FAILED    (err u106))
(define-constant ERR-MARKET-EXISTS      (err u107))
(define-constant ERR-NOT-AGENT          (err u108))

;; ── Authorised agent (set once by owner) ────────────────────
(define-data-var agent-address principal CONTRACT-OWNER)

(define-public (set-agent (new-agent principal))
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-OWNER)
    (var-set agent-address new-agent)
    (ok true)
  )
)

(define-read-only (get-agent)
  (var-get agent-address)
)

;; ── Market storage ───────────────────────────────────────────
;; status: 0=open 1=resolved
(define-map markets
  { market-id: (string-ascii 36) }
  {
    status:           uint,      ;; 0=open 1=resolved
    yes-pool:         uint,      ;; micro-USDCx
    no-pool:          uint,
    winning-side:     (string-ascii 3),   ;; "yes" or "no" or ""
    resolution-price: uint,      ;; price * 1e8 (8 decimal fixed point)
  }
)

;; ── Stake storage ────────────────────────────────────────────
(define-map stakes
  { market-id: (string-ascii 36), staker: principal, side: (string-ascii 3) }
  { amount: uint, paid-out: bool }
)

;; Convenience: total staked by address in a market (any side)
(define-map staker-total
  { market-id: (string-ascii 36), staker: principal }
  { total: uint }
)

;; ── Create market ────────────────────────────────────────────
;; Only the agent can open a market (called server-side when market is created in DB)
(define-public (create-market (market-id (string-ascii 36)))
  (begin
    (asserts! (is-eq tx-sender (var-get agent-address)) ERR-NOT-AGENT)
    (asserts! (is-none (map-get? markets { market-id: market-id })) ERR-MARKET-EXISTS)
    (map-set markets
      { market-id: market-id }
      { status: u0, yes-pool: u0, no-pool: u0, winning-side: "", resolution-price: u0 }
    )
    (ok true)
  )
)

;; ── Stake ────────────────────────────────────────────────────
;; User calls this directly via Hiro wallet.
;; amount is in micro-USDCx (6 decimals → 1 USDCx = 1_000_000)
(define-public (stake
    (usdcx-contract <sip010-trait>)
    (market-id (string-ascii 36))
    (side (string-ascii 3))
    (amount uint))
  (let (
    (market (unwrap! (map-get? markets { market-id: market-id }) ERR-MARKET-NOT-FOUND))
    (existing-stake (default-to { amount: u0, paid-out: false }
      (map-get? stakes { market-id: market-id, staker: tx-sender, side: side })))
  )
    ;; Validations
    (asserts! (is-eq (get status market) u0) ERR-MARKET-NOT-OPEN)
    (asserts! (or (is-eq side "yes") (is-eq side "no")) ERR-INVALID-SIDE)
    (asserts! (> amount u0) ERR-ZERO-AMOUNT)

    ;; Pull USDCx from user into this contract
    (try! (contract-call? usdcx-contract transfer
      amount
      tx-sender
      (as-contract tx-sender)
      none
    ))

    ;; Update stake record
    (map-set stakes
      { market-id: market-id, staker: tx-sender, side: side }
      { amount: (+ (get amount existing-stake) amount), paid-out: false }
    )

    ;; Update pool totals
    (if (is-eq side "yes")
      (map-set markets { market-id: market-id }
        (merge market { yes-pool: (+ (get yes-pool market) amount) }))
      (map-set markets { market-id: market-id }
        (merge market { no-pool: (+ (get no-pool market) amount) }))
    )

    (ok true)
  )
)

;; ── Read stake ───────────────────────────────────────────────
(define-read-only (get-stake (market-id (string-ascii 36)) (staker principal) (side (string-ascii 3)))
  (map-get? stakes { market-id: market-id, staker: staker, side: side })
)

(define-read-only (get-market (market-id (string-ascii 36)))
  (map-get? markets { market-id: market-id })
)

;; ── Payout single winner (called by agent in a loop) ─────────
;; Agent calls this once per winning stake after resolving.
;; Sends the staker their principal + pro-rata share of the loser pool (minus fee).
(define-public (payout-winner
    (usdcx-contract <sip010-trait>)
    (market-id (string-ascii 36))
    (staker principal)
    (payout-amount uint))
  (let (
    (stake-rec (unwrap! (map-get? stakes { market-id: market-id, staker: staker, side: "yes" }) ERR-MARKET-NOT-FOUND))
    (market (unwrap! (map-get? markets { market-id: market-id }) ERR-MARKET-NOT-FOUND))
  )
    (asserts! (is-eq tx-sender (var-get agent-address)) ERR-NOT-AGENT)
    (asserts! (is-eq (get status market) u1) ERR-MARKET-NOT-OPEN)
    (asserts! (not (get paid-out stake-rec)) ERR-ALREADY-RESOLVED)

    ;; Send payout from contract to winner
    (try! (as-contract
      (contract-call? usdcx-contract transfer
        payout-amount
        tx-sender
        staker
        none
      )
    ))

    ;; Mark paid out
    (map-set stakes
      { market-id: market-id, staker: staker, side: "yes" }
      (merge stake-rec { paid-out: true })
    )
    (ok true)
  )
)

;; Same for NO winners — separate function to keep Clarity simple
(define-public (payout-winner-no
    (usdcx-contract <sip010-trait>)
    (market-id (string-ascii 36))
    (staker principal)
    (payout-amount uint))
  (let (
    (stake-rec (unwrap! (map-get? stakes { market-id: market-id, staker: staker, side: "no" }) ERR-MARKET-NOT-FOUND))
    (market (unwrap! (map-get? markets { market-id: market-id }) ERR-MARKET-NOT-FOUND))
  )
    (asserts! (is-eq tx-sender (var-get agent-address)) ERR-NOT-AGENT)
    (asserts! (is-eq (get status market) u1) ERR-MARKET-NOT-OPEN)
    (asserts! (not (get paid-out stake-rec)) ERR-ALREADY-RESOLVED)

    (try! (as-contract
      (contract-call? usdcx-contract transfer
        payout-amount
        tx-sender
        staker
        none
      )
    ))

    (map-set stakes
      { market-id: market-id, staker: staker, side: "no" }
      (merge stake-rec { paid-out: true })
    )
    (ok true)
  )
)

;; ── Resolve market ───────────────────────────────────────────
;; Agent calls this to mark a market resolved.
;; Actual payout calls happen separately (payout-winner / payout-winner-no).
(define-public (resolve-market
    (market-id (string-ascii 36))
    (winning-side (string-ascii 3))
    (resolution-price uint))
  (let (
    (market (unwrap! (map-get? markets { market-id: market-id }) ERR-MARKET-NOT-FOUND))
  )
    (asserts! (is-eq tx-sender (var-get agent-address)) ERR-NOT-AGENT)
    (asserts! (is-eq (get status market) u0) ERR-ALREADY-RESOLVED)
    (asserts! (or (is-eq winning-side "yes") (is-eq winning-side "no")) ERR-INVALID-SIDE)

    (map-set markets
      { market-id: market-id }
      (merge market {
        status: u1,
        winning-side: winning-side,
        resolution-price: resolution-price,
      })
    )
    (ok true)
  )
)

;; ── Agent sweeps protocol fee ────────────────────────────────
;; Any leftover USDCx in the contract (5% fee + unclaimed loser pool)
;; can be swept by the agent wallet.
(define-public (sweep-fees (usdcx-contract <sip010-trait>) (amount uint))
  (begin
    (asserts! (is-eq tx-sender (var-get agent-address)) ERR-NOT-AGENT)
    (try! (as-contract
      (contract-call? usdcx-contract transfer
        amount
        tx-sender
        (var-get agent-address)
        none
      )
    ))
    (ok true)
  )
)
