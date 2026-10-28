# Video script (max 10 minutes total, upload as UNLISTED on YouTube)
Record the screen with OBS or Win+G. Use real numbers from your running app; where a line says [read it off the screen], do that.
YouTube: Upload video > Visibility > **Unlisted** > Save > copy the link. Open it in incognito to check.

## Part 1: Customer pitch (about 5 minutes)
**0:00-0:45 The problem.** "You buy power in the day-ahead market, one day before delivery. Every MW of wind you over-count is a MW you must cover later at imbalance prices. So two questions: what forecast did we really have when we decided, and how much can we trust it?"
**0:45-2:00 Decision day tab.** Pick a day (e.g. 15 Jan). "This is the forecast as it stood at [cutoff] the day before, 24 hours, with the time each was published. The shaded band is the range actual wind fell in, historically, for forecasts like this." Toggle actual on: "Here is what really happened."
**2:00-3:15 Procurement calculator.** Enter demand, choose 95%. "At 95% confidence you would add [read buffer MW] of cover, about [extra MWh] for the day." State plainly it is illustrative with flat demand.
**3:15-4:15 Accuracy tab.** "Over January decisions the average miss is [MAE] MW, with a bias of [bias] MW. 9 times in 10 the miss is under [P90]. The forecast beats a naive guess by [skill]%." Mention error grows with forecast horizon, so the freshest run before cutoff matters.
**4:15-5:00 Close.** "Everything is downloadable, the cutoff is adjustable to your gate closure, and data quality is shown openly. Next steps: your real demand profile, price data, and a rolling live view."

## Part 2: Tech lead review (about 5 minutes)
**0:00-0:45 Architecture.** Show the README diagram. "FastAPI backend, React frontend served as static files from the same container, Docker image, deployed on Heroku. Data loads in a background thread; endpoints return 503 until ready and the UI polls health."
**0:45-1:45 Data.** Open `elexon.py`. "FUELHH by settlementDate, WINDFOR by publish time, as the API requires. Actuals are half-hourly, forecasts hourly, so I evaluate hourly. WINDFOR has about 8 runs a day with rows for already-past hours that I drop. A committed snapshot means the deployed app does not depend on Elexon at runtime."
**1:45-3:00 The core logic.** Open `analysis.at_cutoff`. "For each target hour, the latest run published at or before cutoff on D-1. Nothing later is used, so there is no look-ahead. The error band uses only errors from days before the delivery day." Show the cutoff unit test.
**3:00-3:45 Analysis choices.** Metrics, naive 48h benchmark (always known on D-1), by wind level and horizon. Mention the peak-vs-average definition caveat.
**3:45-4:30 Practices.** Pure functions separate from I/O, 23 pytest tests (run them on screen), ruff, GitHub Actions CI, non-root Docker with health check, input validation, clear error states.
**4:30-5:00 Limits and next steps.** Cutoff is an assumption, flat-demand calculator, national level only; next: scheduled refresh, demand and price inputs, auth.
