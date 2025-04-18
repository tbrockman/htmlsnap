.PHONY: license

license:
	@echo "Running addlicense on all tracked, non-ignored source files..."
	@git ls-files --exclude-standard | grep -vE '(^pnpm-lock\.yaml$$|^.gitignore$$)' | xargs addlicense -c "Theodore Brockman" -l "AGPL-3.0-or-later" -s -v
