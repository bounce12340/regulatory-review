#!/usr/bin/env python3
import subprocess

# Erase stored credentials
subprocess.run(
    ['git', 'credential', 'reject'],
    input=b'protocol=https\nhost=github.com\n\n',
)
# Remove credential helper to force re-auth
subprocess.run(['git', 'config', '--global', '--unset', 'credential.helper'], capture_output=True)
print("Credentials cleared. Now try: git push")
