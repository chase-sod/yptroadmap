=== Scouts QLD - Youth Program Team Roadmap ===
Contributors: chase-sod
Tags: scouts, roadmap, planner, timeline, gantt, event calendar
Requires at least: 5.4
Tested up to: 6.7
Requires PHP: 7.4
Stable tag: 1.0.1
License: GPLv2 or later

Interactive, responsive multi-view roadmap and planner for Scouts Queensland Youth Program Team with real-time central database sync.

== Description ==

Scouts QLD Youth Program Team Roadmap provides a modern, interactive planning canvas for state-wide and branch-level scouting events, leader training, school terms, public holidays, and advisory blackout/lockout dates.

Key Features:
* **Standalone Theme-Independent Page**: Renders in full-screen on `/ypt-roadmap/` with zero CSS or header/footer interference from the active WordPress theme.
* **WordPress Central Database Persistence**: All task edits, dates, categories, and blockouts save directly to the WordPress database via the official REST API (`/wp-json/scouts-ypt/v1/data`).
* **Multi-User Collaboration**: Live change-detection alerts team members when someone else updates the roadmap.
* **Monthly & Weekly Interactive Timelines**: Switch between long-range multi-year views and week-by-week operational planners.
* **Full-Width PDF & CSV Exports**: One-click print-ready landscape exports and spreadsheet downloads.
* **Lockout / Blockout Corridor Visualizations**: Highlights moratoriums, holiday shutdowns, and branch conferences.
* **Embed Shortcode**: Easily embed the roadmap into any standard page using `[scouts_ypt_roadmap]`.

== Installation ==

1. Upload the `scouts-ypt-roadmap.zip` file via **Plugins > Add New > Upload Plugin** in your WordPress admin dashboard.
2. Click **Activate Plugin**.
3. The plugin will automatically seed the initial master dataset and create the clean `/ypt-roadmap/` endpoint.
4. Visit `https://your-domain.org.au/ypt-roadmap/` to use the interactive dashboard.
5. In **wp-admin > YPT Roadmap**, you can configure permissions, customize the URL slug, or restore database backups.

== Changelog ==

= 1.0.0 =
* Initial release with 341 master events, monthly & weekly timeline views, REST API persistence, and shortcode support.
