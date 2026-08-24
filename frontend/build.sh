#!/bin/bash
# Replaces the local API URL in auth.js with the injected Vercel Production URL during build phase
if [ -n "$API_URL" ]; then
  echo "Injecting Production API URL into auth.js: $API_URL"
  sed -i "s|http://localhost:4000|$API_URL|g" js/auth.js
else
  echo "No API_URL found, retaining localhost."
fi
