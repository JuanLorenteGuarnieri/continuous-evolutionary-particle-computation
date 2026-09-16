# Behavioral Test Suite

This package validates MFM v3 behavioral correctness for both TypeScript CPU reference and C++ oracle.

## Test families

See `test-manifest.json` for the list. Each family has a JSON data file under `data/` with config, initial population and expected output.

## Running

pnpm test --filter behavioral
```
## Adding tests

1. Add data file under `data/`
2. Update `test-manifest.json`
3. Add Vitest test referencing the data
```
