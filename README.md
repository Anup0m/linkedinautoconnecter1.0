# 🚀 LinkedIn Auto-Connect Pro

[![Chrome Extension](https://img.shields.io/badge/Platform-Chrome%20Extension-blue.svg?style=for-the-badge&logo=google-chrome)](https://developer.chrome.com/docs/extensions/)
[![Manifest Version](https://img.shields.io/badge/Manifest-V3-orange.svg?style=for-the-badge)](https://developer.chrome.com/docs/extensions/mv3/intro/)
[![License](https://img.shields.io/badge/License-MIT-green.svg?style=for-the-badge)](LICENSE)

A smart, automated, and safe networking companion designed to accelerate your LinkedIn connection-request workflow. Built as a client-side Chrome Extension, it allows professionals and students to targetedly grow their network with college alumni, peers, and industry leaders without repetitive manual effort.

> [!NOTE]
> **Hobby Project:** This tool was created purely for fun to make my own day-to-day networking tasks easier. It is entirely non-commercial.

> [!IMPORTANT]
> **Privacy First:** This extension runs **100% client-side**. It does not scrape, store, or transmit your LinkedIn credentials, cookies, or profile data to any external server. All configuration data and session logs are saved locally in your browser's storage.


---

## 🌟 Key Features

* **⚡ One-Click Batch Connect**
  Scan any LinkedIn page containing profile cards and queue connection requests automatically. Pause, resume, or stop the batch at any moment.
* **🛡️ Human-Like Safety Pacing**
  To mimic natural human browsing and prevent account flags, the extension introduces configurable, randomized delays (4–9 seconds) between connection clicks and features a cool-down strategy.
* **✍️ Personalized Note Templates**
  Create templates using variable placeholders like `{first_name}` (automatically parsed from LinkedIn profile pages) to make every request personalized.
* **📊 Weekly Quota Tracker**
  LinkedIn limits weekly connection requests. The extension keeps a running 7-day log of sent invitations to warn you before you hit LinkedIn's limits.
* **🔍 Smart Deduplication**
  Maintains a local log of profile URLs you have already requested. Automatically skips them in subsequent sessions so you never double-request.
* **🎯 Alumni Page Targeting**
  Seamlessly integrates with the LinkedIn Alumni dashboard to target specific schools, graduation years, locations, and companies.

---

## 📂 Repository Structure

The project has a lightweight architecture with no external framework dependencies:

```text
├── icons/                    # Extension icon assets (16px, 32px, 48px, 128px)
├── manifest.json             # Extension metadata & permission configuration (MV3)
├── background.js             # Background worker managing state, queues, and rate-limiting
├── content.js                # DOM automation script injected into LinkedIn pages
├── floating_panel.css        # Styles for the floating action panel on LinkedIn
├── popup.html                # Main popup interface layout
├── popup.css                 # Custom styles for the extension popup
├── popup.js                  # Popup UI state and controller logic
├── PRD_LinkedIn_AutoConnect.md # Product Requirements Document (detailed specs)
└── README.md                 # Project documentation (this file)
```

---

## 🛠️ Installation & Setup

Since this is a developer version, you can load it as an **unpacked extension** in your Chrome-based browser:

1. **Download the Repository:**
   Clone this repository to your local machine:
   ```bash
   git clone https://github.com/your-username/linkedin-autoconnect-pro.git
   ```
   *(Or download and extract the ZIP file of this repository.)*

2. **Open Extensions Page:**
   Open Google Chrome and navigate to `chrome://extensions/` (or click the three-dot menu $\rightarrow$ **Extensions** $\rightarrow$ **Manage Extensions**).

3. **Enable Developer Mode:**
   Toggle the **Developer mode** switch in the top-right corner of the Extensions page.

4. **Load Unpacked:**
   Click the **Load unpacked** button in the top-left corner.

5. **Select the Project Folder:**
   Choose the folder containing this project (the directory where `manifest.json` is located).

6. The **LinkedIn Auto-Connect Pro** icon will now appear in your extensions list! Pin it for quick access.

---

## 🚀 How to Use

1. **Set Up Templates:**
   * Click the extension icon in your browser toolbar to open the control panel.
   * Go to the **Templates** tab and draft your custom connection note. You can include `{first_name}` to automatically customize the message.
2. **Configure Settings:**
   * Go to the **Settings** tab to adjust session caps (e.g., maximum 20 requests per batch) and delay ranges (e.g., 4–9 seconds).
3. **Navigate to LinkedIn:**
   * Go to [LinkedIn](https://www.linkedin.com).
   * Navigate to any page showing people listings, such as:
     * Your university/school's alumni directory: `linkedin.com/school/<school-name>/alumni`
     * Standard LinkedIn search results under "People"
     * "People You May Know" page
4. **Trigger Auto-Connect:**
   * A floating **Auto-Connect** widget will appear in the bottom-right corner of the LinkedIn page.
   * Select your preferred template, set your request limit, and click **Start**.
   * Relax as the extension scrolls, locates target profiles, customizes the notes, and sends invitations safely with random intervals.

---

## 🛡️ Best Practices & Safety

To protect your LinkedIn account from temporary restrictions:
* **Start Slow:** Keep your daily sends to a reasonable level (e.g., 20–30 requests per day) if you have a new or low-connection account.
* **Keep Randomization On:** Do not reduce the delay range below 4 seconds. LinkedIn monitors speed patterns; natural delays keep your activity human-like.
* **Monitor the Dashboard:** Stay within the weekly recommended limit tracked in the extension dashboard.

> [!WARNING]
> **Disclaimer:** This tool is an independent open-source project and is not affiliated, associated, authorized, endorsed by, or in any way officially connected with LinkedIn Corporation. Automating user interactions on LinkedIn carries inherent risks of account warning or restriction if rate limits and best practices are ignored. Use responsibly.

---

## 📝 License

Distributed under the MIT License. See [LICENSE](LICENSE) for more information.
