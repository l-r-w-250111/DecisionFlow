# Decision-Flow PM

Decision-Flow PM is a decision-centered workspace for projects where the path is not fully known in advance.
It is designed for work such as R&D, exploratory development, stage-gate reviews, and cross-functional planning.

Instead of managing everything as a flat task list, Decision-Flow PM focuses on **decision points**:

- **Decision Cards** capture what must be decided, who owns it, what is already known, what is still missing, and what should happen next.
- **Review Mode** supports meeting-time review and decision recording for cards that are ready to decide.
- **Project / Gate Context** lets you connect cards to projects and stage-gate review structures.
- **Timeline View** provides an Excel-gantt alternative focused on **when to decide next**, not only **what to do next**.

---

## What you can do

### Board
- Organize decision cards in 3 columns:
  - `DECIDABLE`
  - `NOT_DECIDABLE`
  - `DECIDED`
- Recalculate card counts and overdue counts from the visible card list
- Open each card from the **Details** button
- Create:
  - Decision Cards
  - Projects
  - Gates

### Card Detail
- Edit core card fields
- Add evidence items
- Record or reopen decisions
- Optionally edit context:
  - Project
  - Gate
  - Parent card
  - Review label
  - Decision criteria

### Review Mode
- Review only cards in `DECIDABLE`
- Use Project / Gate filters when available
- Fall back to whole-review mode if Project / Gate APIs are unavailable
- Optionally create a follow-up card after a decision is recorded
- When possible, auto-link the new follow-up card back to the prior card context

### Timeline
- View Project / Gate / Decision Card milestones on a time axis
- Use decision points and gate markers instead of task bars
- Get a gantt-style overview without turning the system into a task tracker

---

## Who this is for

Decision-Flow PM is useful when:

- the next step depends on evidence, review, or GO / NO-GO decisions
- your work includes repeated decision checkpoints
- you want to make blockers and missing information visible
- you need a review-friendly interface for meetings
- traditional gantt charts feel too task-centric for exploratory work

---

## Quick start with Docker Compose

### Prerequisites
- Docker is already installed on your machine
- This repository contains a Compose YAML file such as `docker-compose.yml`

### 1. Start the application
Run the following command in the repository root:

```bash
docker compose -f docker-compose.yml up --build
```

To run it in the background:

```bash
docker compose -f docker-compose.yml up -d --build
```

> If your repository uses another Compose filename (for example `compose.yml` or `docker-compose.prod.yml`), replace `docker-compose.yml` with the actual filename.

### 2. Open the app
After startup, open the frontend URL defined by your Compose configuration.
In many setups, that will be:

- Frontend: `http://localhost:3000`
- Backend API docs: `http://localhost:8000/docs`

If your port mapping is different, use the ports defined in your Compose YAML.

### 3. Stop the application

```bash
docker compose -f docker-compose.yml down
```

### 4. Rebuild after changes

```bash
docker compose -f docker-compose.yml up --build
```

If containers are already running in the background:

```bash
docker compose -f docker-compose.yml down
docker compose -f docker-compose.yml up -d --build
```

---

## Basic usage flow

1. Create a **Project** if you want to manage work in a project / gate structure.
2. Create **Gates** if your process includes formal checkpoints.
3. Create **Decision Cards** for questions that must be resolved.
4. Use the board to move between:
   - `NOT_DECIDABLE`
   - `DECIDABLE`
   - `DECIDED`
5. Open **Details** to update evidence, context, and decision reasoning.
6. Use **Review Mode** during meetings to process decision-ready cards efficiently.
7. Use **Timeline** when you need a time-axis overview similar to a gantt replacement.

---

## Repository structure (typical)

```text
frontend/
  app/
    page.tsx
    globals.css
    review/page.tsx
    cards/[id]/page.tsx
    timeline/page.tsx
backend/
  app/
    main.py
    models.py
    schemas.py
    crud.py
    db.py
    config.py
README.md
README_ja.md
licenses.txt
privacy_scan_report.txt
```

---


## Third-party licenses

See `licenses.txt` for the main third-party modules and their licenses.
Always confirm the final dependency set from your real project files such as:

- `package.json`
- lockfiles
- `requirements.txt`
- `pyproject.toml`

---

## Project status

This project is currently in active prototyping and UI iteration.
The interface is intentionally structured so it can be adjusted quickly after real usage feedback.

---

## Language versions

- `README_en.md` : English
- `README_ja.md` : Japanese

