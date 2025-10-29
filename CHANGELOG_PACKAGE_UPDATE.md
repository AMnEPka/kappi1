# Changelog - Update package versions for Docker compatibility

## Fixed
- Updated `date-fns` from `^4.1.0` to `^3.0.0`
- Updated `react-day-picker` from `8.10.1` to `9.11.0`

## Reason
These version updates resolve Docker build issues when installing frontend dependencies.
The newer versions of these packages have better compatibility with the current React 19 and Node.js 18 setup.

## Testing
- ✅ Dependencies installed successfully via yarn
- ✅ Docker build should now complete without errors

## Files Changed
- `/app/frontend/package.json`
