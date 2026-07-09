;; ============================================================
;; Quorum Market Registry -- Clarity v1
;; Stacks testnet
;;
;; On-chain transparency layer for Quorum prediction markets.
;; Token custody is handled entirely by the agent's FlowVault vault.
;; This contract only records market state and stake records.
;;
;; Two actors:
;;   AGENT -- creates markets, records stakes, resolves outcomes
;;   USER  -- visible on-chain as staker (recorded by agent)
;;
;; Flow:
;;   1. Agent calls create-market when a market is opened in the DB
;;   2. After a user's FlowVault deposit confirms, agent calls record-stake
;;   3. Agent calls resolve-market when the market expires
;; ============================================================

;; -- Ownership -------------------------------------------------
(define-data-var contract-owner principal tx-sender)

(define-public (transfer-ownership (new-owner principal))
  (begin
    (asserts! (is-eq tx-sender (var-get contract-owner)) ERR-NOT-OWNER)
    (var-set contract-owner new-owner)
    (ok true)
  )
)

;; -- Side constants --------------------------------------------
;; u1 = YES  u0 = NO
(define-constant SIDE-YES u1)
(define-constant SIDE-NO  u0)

;; -- Error codes ------------------------------------------------
(define-constant ERR-NOT-OWNER           (err u100))
(define-constant ERR-MARKET-NOT-OPEN     (err u101))
(define-constant ERR-MARKET-NOT-FOUND    (err u102))
(define-constant ERR-ALREADY-RESOLVED    (err u103))
(define-constant ERR-INVALID-SIDE        (err u104))
(define-constant ERR-ZERO-AMOUNT         (err u105))
(define-constant ERR-MARKET-EXISTS       (err u107))
(define-constant ERR-NOT-AGENT           (err u108))
(define-constant ERR-MARKET-NOT-RESOLVED (err u109))

;; -- Agent ------------------------------------------------------
(define-data-var agent-address principal (var-get contract-owner))

(define-public (set-agent (new-agent principal))
  (begin
    (asserts! (is-eq tx-sender (var-get contract-owner)) ERR-NOT-OWNER)
    (var-set agent-address new-agent)
    (ok true)
  )
)

(define-read-only (get-agent)
  (var-get agent-address)
)

;; -- Market storage ---------------------------------------------
;; status:       u0=open  u1=resolved
;; winning-side: none until resolved -> (some u1)=YES  (some u0)=NO
(define-map markets
  { market-id: (string-ascii 36) }
  {
    status:           uint,
    yes-pool:         uint,   ;; micro-USDCx, mirrors FlowVault deposits
    no-pool:          uint,
    winning-side:     (optional uint),
    resolution-price: uint,   ;; price * 1e8
  }
)

;; -- Stake storage ----------------------------------------------
;; Records each staker's position. Actual USDCx sits in agent's FlowVault.
;; side: u1=YES  u0=NO
(define-map stakes
  { market-id: (string-ascii 36), staker: principal, side: uint }
  { amount: uint, paid-out: bool }
)

;; -- Create market ----------------------------------------------
;; Agent calls once when a market opens in the DB.
(define-public (create-market (market-id (string-ascii 36)))
  (begin
    (asserts! (is-eq tx-sender (var-get agent-address)) ERR-NOT-AGENT)
    (asserts! (is-none (map-get? markets { market-id: market-id })) ERR-MARKET-EXISTS)
    (map-set markets
      { market-id: market-id }
      { status: u0, yes-pool: u0, no-pool: u0, winning-side: none, resolution-price: u0 }
    )
    (ok true)
  )
)

;; -- Record stake -----------------------------------------------
;; Agent calls after a user's FlowVault deposit is confirmed on-chain.
;; amount is micro-USDCx (1 USDCx = 1_000_000).
(define-public (record-stake
    (market-id (string-ascii 36))
    (staker principal)
    (side uint)
    (amount uint))
  (let (
    (market (unwrap! (map-get? markets { market-id: market-id }) ERR-MARKET-NOT-FOUND))
    (existing (default-to { amount: u0, paid-out: false }
      (map-get? stakes { market-id: market-id, staker: staker, side: side })))
  )
    (asserts! (is-eq tx-sender (var-get agent-address)) ERR-NOT-AGENT)
    (asserts! (is-eq (get status market) u0) ERR-MARKET-NOT-OPEN)
    (asserts! (or (is-eq side SIDE-YES) (is-eq side SIDE-NO)) ERR-INVALID-SIDE)
    (asserts! (> amount u0) ERR-ZERO-AMOUNT)

    (map-set stakes
      { market-id: market-id, staker: staker, side: side }
      { amount: (+ (get amount existing) amount), paid-out: false }
    )

    (if (is-eq side SIDE-YES)
      (map-set markets { market-id: market-id }
        (merge market { yes-pool: (+ (get yes-pool market) amount) }))
      (map-set markets { market-id: market-id }
        (merge market { no-pool: (+ (get no-pool market) amount) }))
    )

    (ok true)
  )
)

;; -- Resolve market ---------------------------------------------
;; Agent calls once when the market expires.
;; Actual payouts are executed via FlowVault routing rules (off this contract).
(define-public (resolve-market
    (market-id (string-ascii 36))
    (winning-side uint)
    (resolution-price uint))
  (let (
    (market (unwrap! (map-get? markets { market-id: market-id }) ERR-MARKET-NOT-FOUND))
  )
    (asserts! (is-eq tx-sender (var-get agent-address)) ERR-NOT-AGENT)
    (asserts! (is-eq (get status market) u0) ERR-ALREADY-RESOLVED)
    (asserts! (or (is-eq winning-side SIDE-YES) (is-eq winning-side SIDE-NO)) ERR-INVALID-SIDE)

    (map-set markets
      { market-id: market-id }
      (merge market {
        status: u1,
        winning-side: (some winning-side),
        resolution-price: resolution-price,
      })
    )
    (ok true)
  )
)

;; -- Mark paid out ----------------------------------------------
;; Agent calls after FlowVault payout tx confirms, to record it on-chain.
(define-public (mark-paid-out
    (market-id (string-ascii 36))
    (staker principal))
  (let (
    (market   (unwrap! (map-get? markets { market-id: market-id }) ERR-MARKET-NOT-FOUND))
    (win-side (unwrap! (get winning-side market) ERR-MARKET-NOT-RESOLVED))
    (stake-rec (unwrap! (map-get? stakes { market-id: market-id, staker: staker, side: win-side }) ERR-MARKET-NOT-FOUND))
  )
    (asserts! (is-eq tx-sender (var-get agent-address)) ERR-NOT-AGENT)
    (asserts! (is-eq (get status market) u1) ERR-MARKET-NOT-RESOLVED)
    (asserts! (not (get paid-out stake-rec)) ERR-ALREADY-RESOLVED)

    (map-set stakes
      { market-id: market-id, staker: staker, side: win-side }
      (merge stake-rec { paid-out: true })
    )
    (ok true)
  )
)

;; -- Read helpers -----------------------------------------------
(define-read-only (get-market (market-id (string-ascii 36)))
  (map-get? markets { market-id: market-id })
)

(define-read-only (get-stake (market-id (string-ascii 36)) (staker principal) (side uint))
  (map-get? stakes { market-id: market-id, staker: staker, side: side })
)
