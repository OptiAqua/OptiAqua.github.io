# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] - 2026-06-22

### Added
- **HR Sync**: `rs:Command=Render` parameter to SSRS URL for proper CSV data export
- **HR Sync**: Auto-detection of detail header row supporting both old (`EmpID,FIRSTNM,LASTNM`) and new (`First,Last,Department,Status`) SSRS column formats
- **HR Sync**: Column name mapping table (`COLUMN_MAP`) to normalize changed SSRS report columns to internal property names
- **HR Sync**: BOM (Byte Order Mark) stripping from SSRS CSV responses
- **HR Sync**: Diagnostic logging — dumps SSRS URL, response size, header row location, and first N lines when parsing fails
- **Competition**: `when:7d` recency filter on Google News RSS queries to prioritize recent articles
- **Competition**: Multiple `searchTerms` per competitor for broader news coverage (e.g., "Xylem water", "Xylem Inc")
- **Competition**: Finnhub `/company-news` API as secondary news source for public companies (last 30 days)
- **Competition**: Broad industry news query (`wastewater treatment technology`) stored in `_index` document for the news strip
- **Competition**: Article deduplication by title similarity when merging Google News + Finnhub results
- **Frontend**: `timeAgo()` helper function showing relative dates on news items (e.g., "2d ago", "3h ago")
- **Frontend**: Industry news strip now reads curated headlines from `_index` Firestore document
- **Frontend**: News source attribution displayed on competitor cards
- `.gitignore` with exclusions for `serviceaccount.json`, `.env`, `node_modules`, and OS/editor files

### Changed
- **Competition**: Articles older than 30 days are now filtered out and results are sorted newest-first
- **Competition**: Fallback broader search (without `when:7d`) when company-specific 7-day search returns no results
- **Competition**: `_index` document now stores up to 8 industry news headlines (previously empty array)
- **Frontend**: Industry news strip sources headlines from `_index` document instead of first competitor's news array

### Fixed
- **HR Sync**: SSRS CSV export returning empty data — was missing `rs:Command=Render` in the ReportServer URL
- **HR Sync**: Parser failing to find header row after SSRS report was modified (2026-06-11) — column names changed from `EmpID,FIRSTNM,LASTNM` to `First,Last,Department,Status`
- **Config**: Removed unnecessary quotes around `SSRS_BASE_URL` and `SSRS_HR_REPORT` in `.env` to prevent dotenv edge cases

## [1.0.0] - 2026-06-21

### Added
- Initial OptiAqua Analytics dashboard with Overview, Sales, Marketing, Shipping, HR, and Competition sections
- Sync server (`sync/sync.js`) with data ingestion from SQL Server (Epicor, Neptune, AquaAerobic), SSRS reports, and internal app health checks
- Firebase Firestore integration for real-time data storage and retrieval
- Competitive intelligence module with Finnhub stock quotes and Google News RSS
- Inventory and Production sync via direct SQL queries
- Scheduled sync via cron (hourly 6am–5pm M–F)
- Demo mode fallback when Firebase is unavailable
