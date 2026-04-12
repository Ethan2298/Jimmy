# Jimmy

An AI-powered SMS sales assistant for a collector car dealership. Jimmy uses Claude to carry on natural, human-sounding text conversations with prospective buyers, automatically qualifying leads, searching inventory, and booking appointments.

## Features

- **Natural SMS conversations** — AI persona ("Jimmy") texts like a real car guy, not a chatbot
- **Inventory search** — Claude searches 25+ collector cars by make, model, year, price, and condition
- **Lead qualification** — Automatically captures and scores leads as the conversation progresses
- **Appointment booking** — Schedules calls, visits, and video walkarounds
- **Dashboard** — Real-time stats on inventory, leads, and conversations
- **Humanizer** — Post-processes AI output to vary openers, limit emojis, and split messages with realistic typing delays

## Tech Stack

- **Backend:** Python, FastAPI, SQLite
- **AI:** Anthropic Claude (tool use / function calling)
- **Frontend:** React, TypeScript, Vite, Tailwind CSS
- **Testing:** pytest, httpx

## Quick Start

### Prerequisites

- Python 3.11+
- Node.js 18+
- An [Anthropic API key](https://console.anthropic.com/)

### Setup

```bash
# Clone the repo
git clone <repo-url> && cd Jimmy

# Copy environment file and add your API key
cp .env.example .env

# Option A: use the startup script (Git Bash on Windows)
bash start.sh

# Option B: manual setup
python -m venv venv
source venv/Scripts/activate   # Windows Git Bash
# source venv/bin/activate     # macOS / Linux

pip install -r requirements.txt
cd frontend && npm install && cd ..

# Seed the database
python seed_database.py

# Start backend
uvicorn backend.main:app --reload --port 8000

# In a separate terminal, start frontend
cd frontend && npm run dev
```

### Access

- **Frontend:** http://localhost:5173
- **Backend API:** http://localhost:8000
- **API docs:** http://localhost:8000/docs

## Project Structure

```
Jimmy/
├── backend/
│   ├── ai/
│   │   ├── engine.py          # Claude tool-use loop
│   │   ├── humanizer.py       # Post-processing (split, delay, emoji)
│   │   ├── system_prompt.py   # Jimmy persona & instructions
│   │   └── tools.py           # Tool definitions & dispatch
│   ├── routes/
│   │   ├── cars.py            # Inventory CRUD endpoints
│   │   ├── conversations.py   # Conversation endpoints
│   │   ├── leads.py           # Lead endpoints
│   │   └── sms.py             # Inbound SMS handler
│   ├── services/
│   │   ├── appointments.py    # Appointment logic
│   │   ├── inventory.py       # Car search & CRUD
│   │   └── leads.py           # Lead management & scoring
│   ├── config.py              # Settings from env vars
│   ├── database.py            # SQLite connection & schema
│   ├── main.py                # FastAPI app & startup
│   └── models.py              # Pydantic models
├── frontend/                  # React + Vite + Tailwind
├── tests/
│   ├── test_tools.py          # Tool function tests
│   ├── test_ai_engine.py      # AI engine tests (mocked)
│   └── test_conversation_flow.py  # Integration tests
├── data/                      # SQLite database (generated)
├── seed_database.py           # Database seeder (25 cars)
├── requirements.txt
├── start.sh
└── .env.example
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/sms/inbound` | Handle inbound SMS and return AI response |
| GET | `/api/cars` | List all cars |
| GET | `/api/cars/{id}` | Get car details |
| POST | `/api/cars` | Add a car |
| GET | `/api/leads` | List all leads |
| POST | `/api/leads` | Create a lead |
| GET | `/api/appointments` | List all appointments |
| POST | `/api/appointments` | Book an appointment |
| GET | `/api/dashboard/stats` | Dashboard statistics |
| GET | `/api/sms/conversations` | List conversations |

## Screenshot

> _Screenshot placeholder — add a screenshot of the dashboard here._

## License

MIT
