const { withAndroidStyles, withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const withAutofillDrawable = (config) => {
  return withDangerousMod(config, [
    'android',
    async (config) => {
      const resDir = path.join(
        config.modRequest.platformProjectRoot,
        'app',
        'src',
        'main',
        'res'
      );
      const drawableDir = path.join(resDir, 'drawable');
      if (!fs.existsSync(drawableDir)) {
        fs.mkdirSync(drawableDir, { recursive: true });
      }
      const filePath = path.join(drawableDir, 'autofill_highlight.xml');
      const xmlContent = `<?xml version="1.0" encoding="utf-8"?>
<shape xmlns:android="http://schemas.android.com/apk/res/android">
    <solid android:color="@android:color/transparent" />
</shape>
`;
      fs.writeFileSync(filePath, xmlContent, 'utf-8');
      return config;
    },
  ]);
};

const withAutofillStyle = (config) => {
  return withAndroidStyles(config, (config) => {
    const styles = config.modResults;
    const appTheme = styles.resources.style?.find(
      (item) => item.$.name === 'AppTheme'
    );
    if (appTheme) {
      if (!appTheme.item) {
        appTheme.item = [];
      }
      const existing = appTheme.item.find(
        (i) => i.$.name === 'android:autofilledHighlight'
      );
      if (!existing) {
        appTheme.item.push({
          $: { name: 'android:autofilledHighlight' },
          _: '@drawable/autofill_highlight',
        });
      }
    }
    return config;
  });
};

module.exports = function withAutofillHighlight(config) {
  return withAutofillStyle(withAutofillDrawable(config));
};
