
const fs = require('fs');
const files = [
  'app/dashboard/cartera/page.tsx',
  'app/dashboard/cierre/page.tsx',
  'app/dashboard/inventario/page.tsx',
  'app/dashboard/mesas/page.tsx',
  'app/dashboard/ventas/page.tsx'
];
for (let file of files) {
  let content = fs.readFileSync(file, 'utf8');
  if (!content.includes('cloudSync')) {
    content = content.replace(
      /const handleSedeChange = \(\) => \{([^}]*)\};\s*window\.addEventListener\('sedeChanged', handleSedeChange\);\s*return \(\) => window\.removeEventListener\('sedeChanged', handleSedeChange\);/gs,
      (match, body) => {
        return \const handleSedeChange = () => {\};
    const handleCloudSync = () => { loadSedeData(); };
    window.addEventListener('sedeChanged', handleSedeChange);
    window.addEventListener('cloudSync', handleCloudSync);
    return () => { window.removeEventListener('sedeChanged', handleSedeChange); window.removeEventListener('cloudSync', handleCloudSync); };\
      }
    );
    fs.writeFileSync(file, content, 'utf8');
    console.log('Patched ' + file);
  }
}

