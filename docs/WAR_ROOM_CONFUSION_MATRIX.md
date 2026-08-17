# War Room — The Kavach Threshold

A text-based decision simulation for management students. Runs in 45–60 minutes, solo or in
teams of three. No software, no dataset, no model training: one 2×2 table, two prices, and
one dial.

**What it tests:** whether a student can read a confusion matrix as a P&L rather than as a
scorecard — and whether they will accept a *worse-looking* model because it is the cheaper
one.

The exercise is authored in the catalogue as the case `war-room-fraud-threshold`
(`prisma/seed-data.ts`), where the supporting facts are released on request. This document is
the facilitator's copy: the full brief, plus the answer key the seed row deliberately
withholds.

---

## 1. The Crisis Setup

Sampann Bank is a mid-size Indian private retail bank. Six weeks ago it deployed **Kavach**, a
machine-learning fraud model, on the *Priority corridor* — card-not-present transactions above
₹25,000, about 10,000 of them a month, made by the bank's wealthiest 4% of customers. When
Kavach scores a transaction above its threshold, the transaction is declined in real time and
the customer gets an SMS.

The vendor's monthly report leads with one number, in 48-point type:

> **Overall Accuracy: 95.0%**

The board is not applauding.

**The CFO** has the fraud line in front of her. Write-offs on this corridor did not fall after
deployment. Last month they were ₹90 lakh. "We bought a system to stop losses and the losses
are the same size as before. Explain the 95%."

**The Head of Priority Banking** is angrier and holds the other half of the problem. Kavach
declined 320 perfectly legitimate transactions last month — a customer's own card, their own
money, refused at the counter. Complaints from the segment are up four-fold. Twenty-nine
Priority customers have moved their primary relationship to another bank in six weeks, and the
exit interviews say the same sentence: *"I was embarrassed in front of a vendor."*

**The Head of Analytics** will not concede an inch. "95% accuracy. It is the most accurate
model this bank has ever run. You are asking me to make it worse."

Everyone in the room is quoting a correct number. You have been brought in to settle it.

---

## 2. The Matrix Data

Kavach's own output on the last 10,000 transactions through the Priority corridor — the same
10,000 the 95% was computed on.

|                          | **Kavach says FRAUD** (blocked) | **Kavach says LEGITIMATE** (approved) | **Total** |
| ------------------------ | ------------------------------: | ------------------------------------: | --------: |
| **Actually fraudulent**  |     **220** — True Positive  |          **180** — False Negative  |   **400** |
| **Actually legitimate**  |     **320** — False Positive |          **9,280** — True Negative |  **9,600** |
| **Total**                |                         **540** |                            **9,460** | **10,000** |

Everything the vendor's report says about this table is true:

| Metric | Value | Reads as |
| --- | --- | --- |
| Accuracy — (TP + TN) ÷ 10,000 | **95.0%** | 9,500 of 10,000 calls were right |
| Fraud base rate — 400 ÷ 10,000 | **4.0%** | fraud is rare; legitimacy is the norm |
| Recall / sensitivity — 220 ÷ 400 | **55.0%** | of all fraud, this much was stopped |
| Precision — 220 ÷ 540 | **40.7%** | of everything blocked, this much was actually fraud |
| Specificity — 9,280 ÷ 9,600 | **96.7%** | of all legitimate spend, this much sailed through |

Note the shape of it before you go further: **9,600 of the 10,000 transactions are legitimate,
and Kavach approves 9,280 of them.** That single cell is 92.8 percentage points of the 95%.

### The asymmetric price of being wrong

The bank's finance team has costed both errors. They are not remotely the same size.

**A False Negative — fraud approved. `₹50,000` each.**

| Component | Amount |
| --- | ---: |
| Average fraudulent ticket in this corridor, written off | ₹42,000 |
| Chargeback processing, investigation, card reissue, regulatory filing | ₹8,000 |
| **Total, per missed fraud** | **₹50,000** |

Direct, certain, and immediate. It lands on this month's P&L as cash out of the door.

**A False Positive — a legitimate transaction declined. `₹5,000` each (expected).**

| Component | Amount |
| --- | ---: |
| Contact-centre handling, card reissue, apology credit | ₹400 |
| 9% of wrongly-declined Priority customers move their primary relationship within 90 days, and the remaining lifetime value of a Priority customer is ₹51,000 → 0.09 × ₹51,000 | ₹4,600 |
| **Total, expected, per wrongly-blocked transaction** | **₹5,000** |

Probabilistic and delayed. It never appears on the fraud line at all — it surfaces months
later as churn, as a falling NPS, and as a segment head who cannot hit their AUM target.

> **The exchange rate: 10 : 1.** One missed fraud costs the bank what ten wrongly-blocked
> customers cost it. The two errors sit in the same 2×2 table, and accuracy charges the same
> price for both.

---

## 3. The Dilemma

You cannot fix this by asking for a better model.

For the next quarter, Kavach's mathematics are frozen. You may not retrain it, buy new data
features, relabel the training set, or hire a single reviewer. The model produces a fraud
score between 0 and 1 for every transaction, and you control exactly one thing:

**the threshold above which Kavach blocks.** It is currently set at 0.50.

Lower the threshold and Kavach becomes more suspicious: it catches more fraud (False Negatives
fall) *and* it blocks more of your own customers (False Positives rise). Raise it and the
trade runs exactly backwards. There is no setting that improves both — every False Negative
you remove is bought and paid for in False Positives.

Engineering has certified five settings, each replayed against the same 10,000 transactions:

| Setting | Threshold | TP | FN | FP | TN | Accuracy | Recall | Precision |
| :-- | :-- | --: | --: | --: | --: | --: | --: | --: |
| **A** | 0.80 — most permissive | 140 | 260 | 90 | 9,510 | **96.5%** | 35.0% | 60.9% |
| **B** | 0.65 | 185 | 215 | 175 | 9,425 | **96.1%** | 46.3% | 51.4% |
| **C** | 0.50 — **live today** | 220 | 180 | 320 | 9,280 | **95.0%** | 55.0% | 40.7% |
| **D** | 0.35 | 300 | 100 | 700 | 8,900 | **92.0%** | 75.0% | 30.0% |
| **E** | 0.20 — most suspicious | 350 | 50 | 1,900 | 7,700 | **80.5%** | 87.5% | 15.6% |

Two things are true of this table and worth noticing early. Every row still contains 400 real
frauds and 9,600 real legitimate transactions — you are not changing the world, only where you
cut it. And the accuracy column does not move in the same direction as anything else in the
room.

**One operational constraint.** Sampann's fraud-operations desk can call back and manually
clear **600 blocked transactions a month**. Beyond 600, the customer waits until someone gets
to them — which is a decline that lasts a day rather than a minute. The desk's headcount is
frozen along with everything else.

---

## 4. The Challenge

Prepare a recommendation for the board. Three parts, in order.

### Task 1 — Price the errors, and put the 95% on trial

1. Calculate the rupee cost of the False Negatives in the live matrix (Setting C).
2. Calculate the rupee cost of the False Positives.
3. Total the monthly bleed, and annualise it.
4. What share of that bleed sits in a single cell of the matrix?
5. Now the argument that settles the room. Work out the accuracy and the cost of the **"approve
   everything"** model — no model at all, every transaction waved through. Compare both numbers
   to Kavach's. Then state, in one sentence, why the Head of Analytics' 95% is a vanity metric
   in this business.

### Task 2 — Choose a direction, and prove it

6. Compute total error cost — `(FN × ₹50,000) + (FP × ₹5,000)` — for all five settings.
7. Name the setting you would ship, and state plainly **which error you are choosing to accept
   more of.**
8. Justify it at the margin, not just at the total. At the boundary you are crossing, how many
   extra False Positives does each avoided False Negative cost you? Compare that ratio to the
   10:1 break-even the two prices imply, and say why it clears the bar.
9. Do the same for the next setting past yours, and explain why you stopped where you did.
10. State the annual value of your recommendation against the live setting.

### Task 3 — Defend the trade-off operationally

11. Your setting produces a specific number of blocked transactions a month. Set that against
    the 600 the fraud desk can clear. If you are over, your recommendation is a number the bank
    cannot actually run — say what you would do about the queue, within the constraint that you
    cannot hire.
12. The ₹5,000 is an *average* built on a 9% churn probability. Name one customer for whom that
    figure is badly wrong, and say what you would do differently for them.
13. **Name the single number that would reverse your recommendation, and the value it would have
    to reach.** Not a vague risk — a number and a threshold.
14. Answer the Head of Analytics in one sentence, given that your recommendation almost
    certainly lowers the accuracy the vendor reports next month.

---

## Facilitator's answer key

Withhold until teams have committed a setting in writing.

### Task 1 — the bleed

| | Calculation | Cost |
| --- | --- | ---: |
| False Negatives | 180 × ₹50,000 | **₹90,00,000** |
| False Positives | 320 × ₹5,000 | **₹16,00,000** |
| **Total, per month** | | **₹1,06,00,000** |
| **Annualised** | × 12 | **₹12.72 crore** |

**85% of the bleed is one cell** — the 180 approved frauds. The cell the room has been arguing
about (the 320 blocked customers) is 15% of the money and 100% of the noise, because a wrongly
blocked customer phones you and a missed fraud does not.

**The vanity-metric proof.** Approve everything, run no model at all:

| | Accuracy | Total error cost |
| --- | --: | ---: |
| Approve everything (no model) | **96.0%** | **₹2,00,00,000** |
| Kavach, live at Setting C | **95.0%** | **₹1,06,00,000** |
| Block everything (bound, for reference) | 4.0% | ₹4,80,00,000 |

**A system that does nothing at all scores a full point *higher* on accuracy than Kavach, and
costs the bank ₹94 lakh a month more.** Accuracy ranked the worse system first. It does that
because 96% of the transactions are legitimate and easy, so the metric is very nearly a
measurement of the base rate; and because it counts a ₹50,000 mistake and a ₹5,000 mistake as
one error each.

The correct read of the whole situation, which the strongest teams reach unprompted: **Kavach
is not a bad model, it is a badly tuned one.** It creates ₹94 lakh a month of value against
doing nothing. The question was never "is 95% good" — it is "of the five thresholds available,
is 0.50 the cheapest one."

### Task 2 — the setting

| Setting | FN cost | FP cost | **Total** | Accuracy |
| :-- | ---: | ---: | ---: | --: |
| A (0.80) | ₹1,30,00,000 | ₹4,50,000 | **₹1,34,50,000** | 96.5% |
| B (0.65) | ₹1,07,50,000 | ₹8,75,000 | **₹1,16,25,000** | 96.1% |
| C (0.50) — live | ₹90,00,000 | ₹16,00,000 | **₹1,06,00,000** | 95.0% |
| **D (0.35)** | ₹50,00,000 | ₹35,00,000 | **₹85,00,000** ← cheapest | 92.0% |
| E (0.20) | ₹25,00,000 | ₹95,00,000 | **₹1,20,00,000** | 80.5% |

**The answer is D.** Direction: *accept more False Positives to buy fewer False Negatives* —
make the model more suspicious, not less. It saves **₹21 lakh a month, ₹2.52 crore a year**
against the live setting.

Note what the accuracy column is doing while this happens. **Accuracy is highest at Setting A
(96.5%), which is the second most expensive setting on the board (₹1.345 crore).** The metric
and the money rank the five options almost in reverse. A team optimising the number the vendor
prints on the front page would move the threshold *up* and burn a further ₹28.5 lakh a month.

The marginal argument, which is what separates a real answer from a lucky one — with FN at
₹50,000 and FP at ₹5,000, it is worth accepting **up to 10 new False Positives for every False
Negative removed:**

| Move | FN removed | FP added | Exchange rate | Verdict |
| :-- | --: | --: | --: | :-- |
| A → B | 45 | 85 | 1.9 : 1 | take it |
| B → C | 35 | 145 | 4.1 : 1 | take it |
| **C → D** | **80** | **380** | **4.75 : 1** | **take it — well inside 10:1** |
| D → E | 50 | 1,200 | 24.0 : 1 | refuse — 2.4× over the bar |

D is where the exchange rate crosses the price. Everything before it is cheap, everything after
it is extortionate. A team that lands on D by adding up five totals has the right answer; a
team that can produce this table understands *why* it is the right answer and will still be
right when the prices change.

### Task 3 — the defence

**11 — the queue is the trap.** Setting D blocks 1,000 transactions a month (300 TP + 700 FP)
against a desk that can clear 600. A team that recommends D and says nothing about this has a
correct number and an undeliverable plan; that is the single most common failure in this
exercise. Credit any of:

- **Step-up authentication instead of a hard decline** — on a blocked transaction, push an OTP
  or biometric re-auth. A genuine customer clears it in fifteen seconds. This converts a
  decline into a *delay*, which cuts the effective cost of a False Positive dramatically —
  and, per the sensitivity below, a cheaper False Positive makes D *more* right, not less.
- **Triage the callback queue by value** rather than first-in-first-out: 600 calls spent on the
  highest-LTV blocked customers, the rest handled by SMS self-clear.
- **A segment carve-out** — run D everywhere except on Priority customers with three-plus years
  of tenure and a clean history, who stay at C. This is the mathematically literate version of
  "the ₹5,000 is an average."

**12 — who the average is wrong for.** The ₹5,000 assumes a 9% chance of losing a ₹51,000
relationship. It is badly wrong in both directions: for the bank's largest relationships (a
₹5-crore AUM customer whose remaining LTV is a hundred times the average, and who is also the
most likely to leave over an insult), and for a dormant customer whose LTV is near zero.
Uniform pricing of a False Positive across a segment that spans both is the real defect in the
current setup.

**13 — the number that flips it.** The break-even is the cost of a False Positive. Holding FN
at ₹50,000, D beats C only while a wrongly-blocked transaction costs **less than ₹10,526**:

> Cost(C) = 180 × 50,000 + 320f Cost(D) = 100 × 50,000 + 700f
> Equal when 380f = ₹40,00,000 → **f = ₹10,526**

The full ladder, which is worth putting on the board:

| If a False Positive really costs… | The cheapest setting is |
| --- | --- |
| under ₹10,526 | **D** (0.35) |
| ₹10,526 – ₹12,069 | C (0.50) — the live setting |
| ₹12,069 – ₹26,471 | B (0.65) |
| over ₹26,471 | A (0.80) |

So the recommendation is not "block more." It is: **at ₹5,000, block more — and the entire
decision turns on a churn assumption of 9%, which nobody in the room has validated.** The best
answer in the room says that out loud and asks for the retention study, having already shipped
D because ₹5,000 would have to be more than doubled before the live setting wins.

Read the other way round, holding FP at ₹5,000: D beats C as long as a missed fraud costs more
than **₹23,750** — less than half the costed figure. The recommendation is robust in that
direction and fragile in the other, and saying which is which is the mark of a good answer.

**A reversed recommendation is fully creditable** — but only with the arithmetic attached. A
team arguing "protect the customer, raise the threshold" must show that FP cost exceeds
₹10,526, and then land on the setting their own number implies (at ₹25,000, that is B, not A).
"Churn is a strategic risk" without a number is the same vanity reasoning as the 95%, wearing
the other side's jersey.

**14 — the answer to the Head of Analytics.** Something equivalent to: *"You are right that
accuracy will fall from 95% to 92%. Accuracy is 96% for a system that approves every fraud in
the book, so it is not the thing we are paid to maximise — ₹85 lakh of losses is better than
₹1.06 crore, and that is the number the board is being asked about."*

### What a top answer looks like

1. Prices both errors and reports ₹1.06 crore a month without prompting.
2. Kills the 95% with the 96% do-nothing baseline — a comparison, not an adjective.
3. Still recognises Kavach is worth ₹94 lakh a month, so the recommendation is *retune*, not
   *rip out*. Teams that conclude "the model is useless" have over-corrected and are wrong.
4. Ships D, defends it at the margin (4.75:1 against a 10:1 bar), and refuses E by the same
   test.
5. Sees the 600-call queue and fixes it, ideally with step-up authentication.
6. Names ₹10,526 as the number that would flip the decision, and asks for the churn study
   anyway.

### Common failure modes

| What they do | What to say |
| --- | --- |
| Defend the 95%, tune nothing | Show them the 96% do-nothing baseline. It ends the argument in one line. |
| Raise the threshold to protect the customer experience, no arithmetic | Ask for the implied cost of a False Positive. If it is under ₹10,526, they have argued for a more expensive bank. |
| Ship E — "catch nearly all the fraud" | 24 False Positives per fraud avoided, at a 10:1 bar. 1,900 blocked customers, and 87.5% recall is still not 100%. |
| Ship D, ignore the queue | Right number, undeliverable plan. The desk clears 600; D blocks 1,000. |
| Ask to retrain the model / buy more data | The constraint is the exercise. Under this quarter's frozen model, the threshold is the only lever — and it is worth ₹2.52 crore a year on its own. |
| Average the two costs into "cost per error" | The asymmetry *is* the lesson. A single blended price makes the confusion matrix redundant. |
