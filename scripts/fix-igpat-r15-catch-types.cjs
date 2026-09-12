const fs = require('node:fs');

const targets = [
  {
    file: 'src/app/(tabs)/buklod.tsx',
    from: '\n    catch(e){\n',
    to: '\n    catch(e:any){\n',
    label: 'Public Community publish catch',
  },
  {
    file: 'src/components/BuklodExclusiveScopeCommunity.tsx',
    from: '\n        catch (error) {\n',
    to: '\n        catch (error:any) {\n',
    label: 'Scoped Community publish catch',
  },
];

for (const target of targets) {
  let source = fs.readFileSync(target.file, 'utf8');
  const count = source.split(target.from).length - 1;
  if (count !== 1) {
    throw new Error(`[IGPAT R15 CATCH TYPES] ${target.label}: expected exactly one match, found ${count}`);
  }
  source = source.replace(target.from, target.to);
  fs.writeFileSync(target.file, source, 'utf8');
}

console.log('IGPAT R15 strict catch typing applied.');
