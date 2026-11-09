# Atlas UI direction

Based on the HUPI & East3 design research, applied to the verified East3 stack:
React 19, Vite, React Router and Capacitor Android. This is a personal daily
companion for shift work, planning, habits, health and finances.

Reading this as: a personal productivity app for one person's shifting routine,
with a calm daily-journal visual language. ENERGY 2 / RHYTHM 2 / MOTION 1.

## Decisions

- Keep the Atlas name, existing destinations and locally bundled Material icons;
  they already identify the installed app and its actions.
- Use teal for actions and progress, a warm sand accent for the daily overview,
  and retain the existing navy and light neutral surfaces for familiar themes.
- Use the system sans-serif stack to keep small labels readable without a font
  download; tabular numbers make progress and financial values easy to compare.
- Make the daily task summary the first focal point. Its ring reflects actual
  task completion, including an explicit empty state and unavailable data.
- Keep swipeable cards for the mobile workflow, with visible counts, previous
  and next controls, keyboard arrows and reduced-motion support.
- Group personal destinations in a uniform navigation grid because they are
  equal entry points; vary the overview, activity rows and financial summary
  according to their information rather than adding decorative cards.
- Use 8/12/16/24/32px spacing, 12px controls, 20px cards and 28px overview corners
  to distinguish interaction from grouped content. Shadows mark overlay elevation.
- Reuse existing buttons, sections, forms and dialogs. Add ProgressRing as a
  reusable data component, without introducing another UI framework or changing
  API contracts, Android plugins or notification scheduling.
- Motion provides brief interaction feedback; no decorative entrance animation.

## Verification

Run the frontend production build and the existing Playwright flows for
navigation, quick creation, calendar, finances, habits, workout, hydration and
themes. Check the overview at narrow phone, tablet and desktop widths in both
themes, including partial resource errors and task completion updates.

### Results, 10 November 2026

| Check                  | Status | Evidence                                                                                                                                                |
| ---------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Build                  | PASS   | Backend typecheck and frontend production build.                                                                                                        |
| Existing data behavior | PASS   | 81 backend tests, including ownership, cache invalidation, shift scheduling and workout records.                                                        |
| Browser flows          | PASS   | All 66 Playwright tests using the production build and mocked API responses.                                                                            |
| Daily overview         | PASS   | Task completion updates the ring; a rejected save rolls it back. Empty and unavailable resources produce different summaries.                           |
| Navigation             | PASS   | Overview links open Calendar/Habits/Finance; Ruang Saya opens its existing destinations; Back restores the parent screen.                               |
| Creation and dialogs   | PASS   | Task, event, transaction and note forms save; rejected saves retain drafts; dialogs close and deletion requires confirmation.                           |
| Theme controls         | PASS   | Header toggle changes the theme; profile choices persist through navigation, reload, system changes and logout.                                         |
| Phone and desktop      | PASS   | Main flows tested at 320/360/390/412/600px; overview also reviewed at 768/1280px. No horizontal overflow or controls below 48px in the checked screens. |
| Keyboard and text      | PASS   | Carousel arrows work from the keyboard; offscreen focus keeps header/navigation visible; landscape forms work with a 200% text size.                    |
| Contrast               | PASS   | Theme text pairs checked with WCAG luminance calculation: minimum 4.97:1 for the new palette; ring tracks and overview action borders exceed 3:1.       |
| Content and visuals    | PASS   | Existing product identity, icons and routes retained. Counts come from dashboard data; no invented people, images, metrics or features.                 |
| Visual direction       | PASS   | Overview, activity rows and feature navigation have distinct hierarchy; purpose and spacing decisions are recorded above.                               |

Screenshots were reviewed for phone/tablet/desktop overviews, both themes,
Ruang Saya, calendar, finances, chat, forms, workouts and exercise guides.
Android permission and GPS flows use browser simulations; physical-device
notification delivery and a new APK were not part of this UI change.

The offline browser test route uses `ATLAS_TEST_STATIC_DIR=web/dist` with a
trusted localhost origin and a test-only `VITE_API_URL=https://atlas.test` build
for the simulated native bridge. Production builds keep the usual project
environment. No database migration or production deployment is required for
validation.
