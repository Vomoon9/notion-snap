# 🤝 Contributing to NotionSnap

Thanks for your interest in NotionSnap! This is an open-source project and community contributions are welcome.

## 🚀 Getting Involved

### Reporting Bugs

1. Search [Issues](https://github.com/Vomoon9/notion-snap/issues) for existing reports
2. If none exists, create a new Issue with:
   - OS + Node.js version
   - Full error log
   - Reproduction steps
   - Brief description of your Notion workspace (page count, databases, etc.)

### Submitting Code

1. Fork this repository
2. Create a branch: `git checkout -b feature/your-feature`
3. Write code
4. Run tests: `npm test`
5. Ensure build passes: `npm run build`
6. Commit and create a Pull Request

## 📋 Development Guidelines

### Code Style

- TypeScript strict mode
- Each module has a single clear responsibility
- Comments in Chinese or English, but function/variable names in English

### Testing

- New features must include unit tests
- Bug fixes must include regression tests
- `npm test` must pass with zero failures

### Notion API Gotchas

If you're modifying Notion API-related code, be aware of these known pitfalls:

1. **SDK `databases.retrieve()` bug**: May return object without `properties` field. Use `fetch()` directly instead.
2. **Table blocks require children**: Creating a `table` block without `children` (rows) fails. Fetch rows first and include them.
3. **Null values cause validation errors**: Notion API rejects `null` in block data. Recursively clean all nulls before sending.
4. **Database schema needs full config objects**: Each property type needs its config object (e.g., `{ select: { options: [] } }`, not just `{ type: 'select' }`).
5. **Select/Status match by name, not ID**: When creating database pages, send `{ select: { name: "P0" } }`, not the option ID.
6. **Rate limit**: ~3 requests/second. Wait 350ms between API calls.
7. **OAuth scope is space-separated**: `page.content.read page.properties.read`, NOT comma-separated.
8. **Append children uses PATCH, not POST**: The `blocks/{id}/children` endpoint requires `PATCH` method. Using `POST` returns a misleading `invalid_request_url` error.
9. **File URLs expire in ~1 hour**: Notion API returns S3 pre-signed URLs for images/files. These expire after 1 hour.
10. **Incompatible properties for cross-workspace restore**: `relation`, `people`, `formula`, `rollup`, `created_time`, `last_edited_time` cannot be restored across workspaces.

### Branch Naming

- `feature/xxx` — New features
- `fix/xxx` — Bug fixes
- `docs/xxx` — Documentation updates

## 📄 License

MIT — contributed code follows the same MIT license.