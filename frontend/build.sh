#!/bin/bash
# Replaces the local API URL in auth.js with the injected Vercel Production URL during build phase
if [ -n "$API_URL" ]; then
  # Strip trailing slash if the user accidentally added one
  CLEAN_URL=${API_URL%/}
  
  # Ensure the URL starts with https://
  if [[ $CLEAN_URL != http* ]]; then
    CLEAN_URL="https://$CLEAN_URL"
  fi

  echo "Injecting Production API URL into auth.js: $CLEAN_URL"
  sed -i "s|http://localhost:4000|$CLEAN_URL|g" js/auth.js
else
  echo "No API_URL found, retaining localhost."
fi
