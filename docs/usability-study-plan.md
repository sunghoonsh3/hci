# Usability Study Plan: PATH (Registration Clarity)

## Overview

PATH is a web tool that replaces the current PATH-to-NOVO registration workflow at Notre Dame. A student pastes their Degree Works audit on `/onboarding`, then moves through four screens: `/search` (filter the Summer 2026 catalog, one row per course with an Eligibility badge of Eligible, Restricted, or Full), `/course/[id]` (full course page with sections, seat counts, and prerequisite text rewritten in plain language), `/plan` (three parallel drafts in Plan A, B, and C tabs with a Mon–Fri weekly calendar that flags time conflicts), and `/export` (pre-check diagnostics and an Export to NOVO button). The goal is that a student can see why a course is blocked before they try to register, rather than finding out at 7 a.m. on registration day.

## Participants

We will run five Notre Dame undergraduates who expect to register for Summer or Fall 2026 classes. Five is enough to surface most of the severe issues (Nielsen, 1993) but too few to be representative of the whole student body, so we recruit for spread on the axes that actually change how someone uses the tool.

| # | Year      | College         | Self-rated PATH/NOVO confidence |
|---|-----------|-----------------|---------------------------------|
| 1 | First-year | Any             | Low (1–2 of 5)                  |
| 2 | Sophomore | Engineering     | Medium                          |
| 3 | Junior    | Arts and Letters| Medium–High                     |
| 4 | Senior    | Mendoza         | High                            |
| 5 | Any year  | Any college     | Self-identified as struggling with registration |

Recruitment comes from flyers in LaFortune and Duncan, the r/NotreDame subreddit, and the CS and Arts-and-Letters Slack groups. Each participant receives a $15 gift card. We deliberately do not test transfer students, double majors, or non-BACS catalogs in this round. A follow-up study should fill those gaps.

## Tasks

Each participant works with a seeded persona named Alex Murphy, a senior BACS student whose audit is already loaded into the app. All five tasks are handed to the participant on a printed card, read aloud once, and worked on while thinking aloud.

> **Task 1.** You are Alex Murphy, a senior Computer Science major. Your Degree Audit text is on the card next to you. Open PATH and load your audit into the system. When you are done, show me where PATH displays your classification, major, and the list of CSE courses you have already completed.
>
> **Task 2.** Alex still needs to take a theology course. Find *THEO 10001: Foundations of Theology: Biblical/Historical* in Summer 2026 and open its course page. Tell me in your own words whether Alex can register for this course, and what the system says would happen if he tried.
>
> **Task 3.** Build three different Summer 2026 schedules for Alex in Plan A, Plan B, and Plan C. Each plan must have at least two courses, total at least 6 credits, and have no time conflicts. The three plans must differ from each other by at least one course or section.
>
> **Task 4.** Try adding *CSE 30872: Programming Challenges* to Plan A. PATH will show a warning because Alex has already taken this course. Using only what is on the screen, decide what to do instead. Either replace it with a different CSE course Alex has not taken, or explain to me why you would leave Plan A as it was.
>
> **Task 5.** Go to the Export to NOVO screen. Read the pre-check for Plan A. Fix anything it flags as a problem, then export the plan.

Tasks build from one screen to the full flow. A participant who fails Task 5 after succeeding at 1–4 has failed the integration of the pre-check, not the basics.

## Measures

Each category has one objective measure read from the screen recording and one subjective measure from a questionnaire.

### Effectiveness

**Objective: task success and critical errors.** For each task the facilitator scores Success, Partial, or Failure against a written success rule (for Task 3: three conflict-free plans, each with at least 6 credits and at least one distinct course). We separately count *critical errors*, defined as actions that would have caused a failed or wrong registration in real life. Task 5 counts a critical error if the participant exports a plan with an unresolved time conflict or a course Alex already took.

**Subjective: post-task confidence.** After each task the participant circles one number on a 7-point scale for the item "I am confident I completed that task correctly" (1 = strongly disagree, 7 = strongly agree). The gap between this and the objective success score is itself useful. A student who thinks they registered and did not is the worst possible outcome.

### Efficiency

**Objective: time on task and click count.** Read from the screen recording. We report the median and range across the five participants for each task, plus the number of clicks and page transitions. Registration runs in narrow seat-grab windows, so both wall clock and interaction cost matter.

**Subjective: SMEQ (Subjective Mental Effort Question).** After each task the participant marks a 0–150 scale labelled from "Not at all hard to do" (0) to "Tremendously hard to do" (around 112). SMEQ is a single-item workload measure that tracks NASA-TLX closely and takes under 15 seconds, so it does not break flow between tasks.

### Satisfaction

**Objective: observed reactions.** Two coders independently watch the camcorder and screen video and tally positive reactions (smile, nod, "oh nice") and negative reactions (sigh, frown, "ugh", leaning back, audible swear) per task. We report counts and Cohen's kappa for inter-rater agreement. Unlike end-of-session self-report, this catches the moment that caused the frustration.

**Subjective: System Usability Scale (SUS).** Ten items, 5-point Likert, given once at the end of the session. The ten items and the scoring formula are in Appendix A. A score above 80 is excellent (top decile), 68 is the industry average, below 51 is unacceptable. Our internal target for PATH is 72 or higher, with 68 as the minimum before we would put it in front of the wider student body.

We also run a short exit interview (about ten minutes): What was the most frustrating moment? What was easier than you expected? If you could change one thing, what would it be?

## Procedure

Each session is 75 minutes in a reserved group-study room in Hesburgh Library. Equipment: one MacBook running the PATH dev build, OBS capturing the screen and microphone, and one consumer camcorder on a tripod pointed at the participant's hands and face. No specialized lab gear.

1. **Consent and brief, 5 minutes.** The facilitator explains that we are testing the software, not the person. The participant signs the IRB consent and recording release.
2. **Demographics, 3 minutes.** Year, college, major, self-rated PATH/NOVO confidence on a 1–5 scale.
3. **Think-aloud warm-up, 5 minutes.** Practice narrating thoughts on a neutral site (book a round-trip flight on Google Flights) so the think-aloud during the real tasks feels natural.
4. **Five tasks, about 45 minutes total.** Tasks are worked in order. Between tasks the facilitator stops the timer, saves the recording segment, hands the participant the confidence and SMEQ sheet, and resets the app to a clean seeded state. If the participant is stuck for more than sixty seconds and asks for help, the facilitator only asks "What are you looking for right now?" and does not point.
5. **SUS, 5 minutes.** Completed on paper so the tested UI is not in the participant's view while they answer.
6. **Exit interview, 10 minutes.** The three questions above, plus follow-ups on any moments the facilitator flagged during observation.
7. **Debrief and payment, 2 minutes.**

After all five sessions, two researchers independently code the recordings for task outcomes, errors, and reactions. Disagreements are resolved by discussion. Quantitative results go into a one-page summary. Qualitative notes are sorted into an affinity diagram of pain points, which becomes the backlog for the next sprint.

## Appendix A: System Usability Scale

Score each item 1 (Strongly Disagree) to 5 (Strongly Agree).

1. I think I would like to use this system frequently.
2. I found the system unnecessarily complex.
3. I thought the system was easy to use.
4. I think I would need the support of a technical person to be able to use this system.
5. I found the various functions in this system were well integrated.
6. I thought there was too much inconsistency in this system.
7. I would imagine most people would learn to use this system very quickly.
8. I found the system very cumbersome to use.
9. I felt very confident using the system.
10. I needed to learn a lot of things before I could get going with this system.

Scoring: for odd items subtract 1 from the response. For even items subtract the response from 5. Add the ten adjusted scores and multiply by 2.5 for a 0–100 result. Above 80 is excellent, 68 is average, 51–68 is marginal, below 51 is unacceptable.

## Appendix B: Per-task sheet

**Confidence.** "I am confident I completed that task correctly." Circle one: 1 (strongly disagree), 2, 3, 4, 5, 6, 7 (strongly agree).

**SMEQ.** Mark one X on the vertical scale:

- 0   Not at all hard to do
- 25  Not very hard to do
- 57  Rather hard to do
- 85  Very hard to do
- 112 Tremendously hard to do
- 150
