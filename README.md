# Careerality

<p align="center">
  <b>Discover careers that actually pay off.</b><br>
  A swipe-based career exploration app that matches you with realistic career paths based on real ROI data.
</p>

---

## About Careerality

Choosing a career is one of the biggest decisions you'll ever make—yet most people fly blind. They don't know what they'll actually earn, how much education will cost, or how long until they're in the black. Careerality changes that by presenting careers as they really are: not job titles, but real days lived by real people.

Our app uses a dating-style swipe interface to present career possibilities, but instead of profiles, users see authentic snapshots of daily work life. Every card shows what someone actually does in a given career—the tasks, the environment, the tradeoffs. We then layer on hard data: salary, education costs, time to break even, and regional cost of living. The result is a career exploration experience that's honest, data-driven, and genuinely useful.

Careerality is designed for anyone asking "what should I do with my life?"—from high school students exploring options to adults considering a career change. It's built to surface careers you might never have heard of, challenge assumptions about prestige versus payoff, and help users make informed decisions backed by real numbers.

---

## Why Careerality Exists

Traditional career guidance suffers from two problems: it's either vague ("follow your passion") or disconnected from financial reality. Even great career counselors can struggle to present salary data, education costs, and regional cost-of-living adjustments in a way that's easy for clients to understand and act on. Students pick careers based on intuition, aesthetics, or societal pressure—and only later discover the financial realities.

Careerality bridges this gap by combining:

- **Authentic career narratives** — real daily experiences, not job descriptions
- **Hard ROI data** — salaries, education costs, time to profitability
- **Personalized filtering** — location, interests, lifestyle preferences
- **Gamified engagement** — actionable next steps that build real career readiness

The app doesn't tell you what to do. It shows you what's possible, what's realistic, and what aligns with your values—then empowers you to take action.

---

## Key Features

### Swipe-Based Career Discovery

The core experience mirrors the intuitiveness of dating apps. Browse careers by swiping:

- **Swipe Right** — Explore this career further
- **Swipe Left** — Not interested

After a right swipe, we ask a single focused question: "What interested you about this?" with 5 tap options:

- Salary and earning potential
- Work environment and culture
- Skills involved
- Job security and stability
- Work-life balance

After a left swipe, we ask: "What put you off?" with options like:

- Education or training requirements
- Salary not meeting expectations
- Unappealing day-to-day work
- Job market concerns
- Location or commute

This feedback loop teaches the algorithm what you actually care about—not just what you say you want—and surfaces better matches over time.

### Real Days, Not Job Titles

Every career card is built around a real person's actual day. We don't show generic descriptions like "Software Developer." We show things like:

- "Today I debugged a production issue for three hours, then pair-programmed with a junior engineer on a new feature. I logged off at 5:30."

- "Spent the morning in a surgical observation, the afternoon documenting patient notes. Still have to study for my board exam next month."

- "Led a site visit with a contractor, reviewed blueprints, and negotiated a change order. Traffic on the way home was brutal."

Users respond to authenticity. By showing the texture of real work—not polished job postings—we help users discover genuine interest or genuine disinterest before they've invested years in a path.

### ROI Calculator

Each career displays a personalized ROI breakdown:

- **Median salary** from Bureau of Labor Statistics data (QCEW, OES, National Compensation Survey)
- **Education and training costs** from IPEDS (Integrated Postsecondary Education Data System)
- **Break-even timeline** — how many years until your earnings exceed your educational investment
- **Regional adjustment** — cost of living based on EPI Family Budget Calculator data

This isn't a generic "average." It's your number, in your region, for your situation.

### Interactive Map View

For users who know where they want to live—or want to explore what's available elsewhere—our map-based interface shows:

- Careers in demand by location
- Salary ranges by metro area
- Education providers nearby
- Remote-friendly vs. location-dependent roles

### Smart Filters

Filter careers by:

- **Interests** — based on O*NET and ESCO skills frameworks
- **Location** — city, state, or remote-first
- **Education pathway** — no degree, associate's, bachelor's, graduate, bootcamp, apprenticeship
- **Time to start** — how soon you can begin earning
- **Work environment** — office, hybrid, field, remote, shift work

### Virtual Career Counselor

Not ready to commit to a direction? Chat with our virtual career counselor. It can:

- Ask clarifying questions about your goals and concerns
- Suggest careers based on your swipe history and feedback
- Explain the ROI data in plain language
- Guide you toward actionable next steps
- Help you think through tradeoffs between options

It is an AI-powered assistant trained on career counseling best practices and informed by your in-app data.

### Gamified Engagement

Choosing a career is just the beginning. Once users identify 3+ interests, we unlock career readiness tasks:

- **Shadow someone** — get connected with a real professional in the field
- **Browse real job postings** — see what's actually hiring in your area
- **Skill deep-dive** — watch short videos on foundational skills for the role
- **Talk to a counselor** — schedule a real (not AI) guidance session
- **Try a mini-project** — complete a small hands-on task related to the field

Completing tasks earns points, maintains streaks, and unlocks leaderboard positions. The gamification isn't empty—it directly builds career readiness.

---

## Data Sources

Careerality is built on authoritative public data:

| Data Type | Source |
|-----------|--------|
| Salary data | Bureau of Labor Statistics (QCEW, OES, National Compensation Survey) |
| Career profiles & skills | O*NET Database, ESCO (European Skills, Competences, Qualifications) |
| Education costs | IPEDS (Integrated Postsecondary Education Data System) |
| Cost of living | EPI Family Budget Calculator |
| Geographic job data | Bureau of Labor Statistics, O*NET |

All data is publicly available, regularly updated, and free from commercial bias. We believe career decisions should be informed by the best available evidence—not sponsored placements.

---

## Tech Stack

Careerality is designed as a modern, cross-platform application:

- **Frontend**: React Native (iOS and Android)
- **Backend**: Ruby on Rails
- **Database**: PostgreSQL
- **Data Processing**: Python (pandas, NumPy) for ROI calculations
- **AI/NLP**: OpenAI API for virtual counselor and card generation
- **Maps**: Mapbox or Google Maps API

This stack is a starting point. Contributors are encouraged to propose architectural improvements.

---

## Getting Started

### Prerequisites

- Node.js 18+ (frontend)
- Ruby 3.1+ with Rails 7+
- Python 3.10+ (data processing)
- PostgreSQL 14+
- npm or yarn, bundler

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/careerality.git
cd careerality

# Install frontend dependencies
cd frontend
npm install

# Install backend dependencies
cd ../backend
bundle install

# Set up environment variables
cp .env.example .env
# Edit .env with your database credentials and API keys

# Set up the database
rails db:create db:migrate

# Start the development server
rails server
```

For detailed setup instructions, see [CONTRIBUTING.md](CONTRIBUTING.md).

---

## Contributing

We welcome contributions from developers, designers, data scientists, career counselors, and anyone passionate about helping people make better career decisions.

### How to Help

- **Code** — Build features, fix bugs, improve performance
- **Data** — Help process and validate data from public sources
- **Design** — Improve UX, create accessible interfaces, design career cards
- **Content** — Write authentic career day narratives
- **Research** — Validate ROI calculations, improve methodology
- **Testing** — Report bugs, suggest improvements

Please read our [Contributing Guide](CONTRIBUTING.md) before submitting pull requests.

---

## Roadmap

### Phase 1 — MVP

- [ ] Swipe interface for career cards
- [ ] ROI data display
- [ ] Basic filtering
- [ ] Post-swipe feedback collection
- [ ] Virtual counselor MVP

### Phase 2 — Engagement

- [ ] Map-based career exploration
- [ ] Gamification system (points, streaks, leaderboards)
- [ ] Task tracking for career readiness
- [ ] User accounts and progress saving

### Phase 3 — Scale

- [ ] Real-time job posting integration
- [ ] Professional mentorship matching
- [ ] Community features (forums, career stories)
- [ ] Multilingual support
- [ ] International data coverage

---

## License

Careerality is open source under the MIT License. See [LICENSE](LICENSE) for details.

---

## Stay Connected

- **Website**: [careerality.app](https://careerality.app)
- **Issues**: [github.com/careerality/careerality/issues](https://github.com/careerality/careerality/issues)
- **Discord**: [Join our community](https://discord.gg/careerality)

---

<p align="center">
  Made with intention by people who believe career guidance should be honest, accessible, and data-driven.
</p>
