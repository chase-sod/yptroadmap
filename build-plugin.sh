#!/bin/bash
# build-plugin.sh
# Re-packages the WordPress plugin into scouts-ypt-roadmap.zip

cd "$(dirname "$0")"

echo "Building scouts-ypt-roadmap.zip..."
rm -f scouts-ypt-roadmap.zip

# Sync any modified assets from the main project into the plugin folder
cp -f "css/styles.css" "wordpress-plugin/scouts-ypt-roadmap/assets/css/styles.css" 2>/dev/null
cp -f "css/print.css" "wordpress-plugin/scouts-ypt-roadmap/assets/css/print.css" 2>/dev/null
cp -f "js/app.js" "wordpress-plugin/scouts-ypt-roadmap/assets/js/app.js" 2>/dev/null
cp -f "data/roadmap-data.json" "wordpress-plugin/scouts-ypt-roadmap/data/default-roadmap.json" 2>/dev/null

cd wordpress-plugin
zip -r ../scouts-ypt-roadmap.zip scouts-ypt-roadmap -x "*.DS_Store*"

echo ""
echo "Done! Created scouts-ypt-roadmap.zip successfully."
ls -lh ../scouts-ypt-roadmap.zip
