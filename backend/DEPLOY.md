# Deploying the backend

Takes about 10 minutes. The Anthropic API key is entered only by you, in the script settings. Never put it in files or in a chat.

1. Open Google Sheets and create a new empty spreadsheet. Name it "Waitlist".
2. In the spreadsheet: menu **Extensions -> Apps Script**. The editor opens.
3. Delete everything in `Code.gs` and paste in the full contents of `backend/Code.gs`. Click the save icon.
4. On the left open **Project Settings** (gear icon) and enable **"Show appsscript.json manifest file in editor"**. Go back to the **Editor**, open `appsscript.json`, delete everything and paste the contents of `backend/appsscript.json`. Save. If the editor rejects the time zone `Europe/Kyiv`, replace it with `Europe/Kiev`.
5. **Project Settings -> Script Properties -> Add script property**. Property: `ANTHROPIC_API_KEY`, value: your Anthropic key. Click **Save script properties**.
6. In the editor pick the function `checkSetup` in the dropdown at the top and click **Run**. Google asks for access: **Review permissions**, choose your account, **Advanced -> Go to project (unsafe) -> Allow**. The execution log should show: `Insights tab rebuilt`, `Sheet "waitlist" ready` and `ANTHROPIC_API_KEY set: yes`. `checkSetup` also creates the `visits` and `demo_runs` tabs and the `Insights` dashboard (as the first tab) and sets the spreadsheet time zone to Kyiv, so there is no need to run `setupInsights` separately. Optional: run `testQuiz`, which makes one real request (less than a cent).
7. **Deploy -> New deployment**. Click the gear next to "Select type" and choose **Web app**. Fields: **Execute as: Me**, **Who has access: Anyone**. Click **Deploy**.
8. Copy the **Web app URL** (it ends in `/exec`) and put it in `web/config.js`. Check: open the URL with `?action=stats` appended; it should return `{"ok":true,"total":0}`.

## Deploying a new version later

**Deploy -> Manage deployments** -> pencil icon on the deployment -> **Version: New version** -> **Deploy**. The URL stays the same. "New deployment" gives a different URL, so do not use it for updates.

If the backend was deployed before the analytics version: after pasting the new `Code.gs`, run `setupInsights` (or `checkSetup`) once in the editor, then deploy a new version as above. The `visits`, `demo_runs` and `Insights` tabs appear; existing rows in `waitlist` are not touched.

## Reading the Insights tab

`Insights` is the first tab of the spreadsheet and a live dashboard of the experiment: it contains only formulas, nothing needs to be run, and the numbers update with every new row. **Funnel**: unique visitors (by anonymous `cid`, one row per person per day), demo runs and unique demo users, waitlist signups. **Visit -> signup** is the share of visitors who left an email; **Demo user -> signup** is the same share among those who tried the generator (people are matched by `cid`). If the second number is clearly higher than the first, the demo helps sell the product: this is the main signal for the hypothesis. **Demo: sample vs own text** shows whether teachers paste their own text (Own text) or only try the examples; own text is a stronger interest signal, and Success rate shows how reliably the generator answers. **Language** is a breakdown by page language. **Last 14 days** and the chart show visits, demos and signups per day, so you can see which post or mailing worked. **Top referrers** lists the referral codes that brought the most people (find the code owner's email by `ref_code` in the `waitlist` tab). Test rows are counted too, so delete them from `waitlist`, `visits` and `demo_runs` before showing the sheet. If the tab was damaged by accident, run `setupInsights` again: it rebuilds without duplicates.

Menu names depend on the Google interface language. The English names are used above.
