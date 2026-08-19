# DocuMind AI: Product & Monetization Roadmap

This roadmap outlines the exact features you need to build to unlock each revenue tier for DocuMind AI. It treats your current codebase as the foundation and layers on SaaS features progressively.

---

## 🎯 Phase 0: The Freelance & Portfolio Tier (Your Current Goal)
**Target Revenue:** $2,000 - $8,000 per custom client project.
**Goal:** Prove the core extraction engine works flawlessly and looks professional enough to sell to businesses as a custom internal tool.

### What to Build:
- [x] **Core Extraction Engine:** Fast API, Pydantic validation, 3-attempt healing loop. *(Already built!)*
- [x] **Basic Database:** SQLite for storing extractions. *(Already built!)*
- [x] **UI Overhaul:** Implement the "New UI" design (dark theme, split preview/results pane, confidence badges).
- [ ] **Demo Polish:** Ensure the drag-and-drop works flawlessly with at least 3 document types (Invoice, Receipt, Contract) for live demos.

> [!TIP]
> **Stop Here for Freelancing:** If your goal is just to get high-paying contract work, do not build any of the phases below. Use Phase 0 as your portfolio piece and start pitching clients.

---

## 🚀 Phase 1: Micro-SaaS Free Tier ($0/mo)
**Target Audience:** Leads, curious users, and tire-kickers.
**Goal:** The Marketing Engine. Let users experience the "Aha!" moment of instant JSON extraction without pulling out a credit card.

### What to Build:
- [ ] **Authentication:** Integrate Clerk, Supabase, or Firebase Auth.
- [ ] **Migrate Database:** Transition from SQLite to PostgreSQL for robust multi-tenant concurrent writes.
- [ ] **Multi-Tenant Logic:** Update your schema so `extractions` are linked to a specific `user_id`. Users can only see their own documents.
- [ ] **Usage Counter:** Track how many pages a user processes per month.
- [ ] **The "Free" Limits:** Hardcode a limit (e.g., 50 pages/month).
- [ ] **Basic Models Only:** Restrict free users to fast/cheap models (e.g., Llama 3 8B) to keep your Groq costs near zero.

---

## 💼 Phase 2: Starter Tier ($11/mo)
**Target Audience:** Solo founders, freelancers, and tiny agencies who have a handful of documents a month.
**Goal:** Validate that people will actually pay for this product (The Impulse Buy).

### What to Build:
- [ ] **Stripe Checkout:** Implement Stripe Payment Links or Stripe Checkout to collect the $11 subscription.
- [ ] **Increased Limits:** Upgrade their account to 500 pages/month.
- [ ] **Export Options:** Add buttons on the UI to "Download JSON" and "Export to CSV" (crucial for accountants/freelancers).
- [ ] **History Retention:** Allow them to view their extraction history from past months.

---

## 📈 Phase 3: Growth Tier ($21/mo)
**Target Audience:** Small accounting teams, real estate brokers, and boutique agencies.
**Goal:** Provide workflow efficiency for users dealing with higher volumes.

### What to Build:
- [ ] **Batch Processing (The Killer Feature):** Allow users to drag-and-drop multiple documents, with a hard limit of a maximum of 50 PDFs per batch to prevent server overload.
- [ ] **Background Queues:** Update your FastAPI backend to use Celery or `BackgroundTasks` heavily so the UI doesn't freeze while 50 invoices are processing. Add a progress bar (`18/50 processed...`).
- [ ] **Increased Limits:** 1,500 pages/month.
- [ ] **Heavy AI Models:** Unlock access to high-accuracy models (e.g., Llama 3 70B, Mixtral) for complex documents.

---

## 🛠️ Phase 4: Pro / Developer Tier ($41 - $91/mo)
**Target Audience:** Other developers and SaaS companies who want to integrate DocuMind into their own apps.
**Goal:** Passive API revenue.

### What to Build:
- [ ] **API Key Management UI:** A settings page where users can click "Generate Secret Key" and revoke old keys.
- [ ] **Public API Endpoints:** Secure your endpoints so users can send a `POST /extract` request with their API key in the header.
- [ ] **Custom Schema Builder (Massive Feature):** Instead of being locked into your predefined "Invoice" schema, let users define their own fields via a UI (e.g., "I need a schema with *Patient Name*, *Procedure Code*, and *Date*"). 
- [ ] **Increased Limits:** 3,000 to 5,000 pages/month.

---

## 🏢 Phase 5: The "Business" Automation Tier ($149+/mo)
**Target Audience:** Logistics companies, large legal firms, mid-market enterprises.
**Goal:** Move from being a "tool" to being invisible, automated infrastructure.

### What to Build:
- [ ] **Webhooks:** A UI where users can paste a URL (e.g., a Zapier webhook or their own server). When a batch of 50 documents finishes processing, your server automatically `POST`s the extracted JSON to their system.
- [ ] **Human-in-the-Loop Queue:** A specific UI dashboard for documents that scored < 85% confidence. An employee logs in, sees the highlighted errors, corrects them manually, and clicks "Approve".
- [ ] **Team Workspaces:** Allow multiple users (Admin, Analyst) to log into the same company workspace and share the credit pool.
- [ ] **Increased Limits:** 10,000+ pages/month + Overage pricing (e.g., $0.02 per extra page).

> [!IMPORTANT]
> **Build Order:** Do not build Phase 2 until you have actual users on Phase 1. Do not build Webhooks (Phase 5) until someone explicitly asks for them. Build exactly what is needed to unlock the next revenue tier, and nothing more.
