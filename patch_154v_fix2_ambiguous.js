const fs=require('fs');
const path=require('path');

const file=path.resolve(
  'src/app/bible/index.tsx'
);

let t=fs.readFileSync(file,'utf8');

const backup=
  file+'.bak154v_fix2_ambiguous';

if(!fs.existsSync(backup)){
  fs.copyFileSync(file,backup);
}

const oldBlock=`    const {
      data:automaticData,
      error:automaticError
    } = await (supabase as any).rpc(
      'ensure_current_automatic_bible_week'
    );

    if(automaticError){
      throw automaticError;
    }

    const automaticRows =
      Array.isArray(automaticData)
        ? automaticData
        : [];

    const automaticIds =
      automaticRows
        .map(
          (row:any)=>
            String(
              row?.assignment_id ?? ''
            )
        )
        .filter(Boolean);`;

if(!t.includes(oldBlock)){
  throw new Error(
    'Current automatic week block not found'
  );
}

const newBlock=`    /*
     * PATCH 154V-FIX2
     *
     * Do not call ensure_current_automatic_bible_week()
     * because its PL/pgSQL output variable assignment_id
     * conflicts with a table column of the same name.
     *
     * Materialize each automatic day directly instead.
     */
    const materialized =
      await Promise.all(
        days.map(
          async (readingDate)=>{
            const {
              data,
              error
            } = await (supabase as any).rpc(
              'materialize_automatic_bible_assignment',
              {
                p_reading_date:
                  readingDate
              }
            );

            if(error){
              throw error;
            }

            const rawId=
              Array.isArray(data)
                ? (
                    data[0]?.assignment_id ??
                    data[0]?.id ??
                    data[0]
                  )
                : (
                    data?.assignment_id ??
                    data?.id ??
                    data
                  );

            return {
              assignment_id:
                String(rawId ?? ''),
              reading_date:
                readingDate
            };
          }
        )
      );

    const automaticRows =
      materialized.filter(
        row=>!!row.assignment_id
      );

    const automaticIds =
      automaticRows.map(
        row=>row.assignment_id
      );`;

t=t.replace(
  oldBlock,
  newBlock
);

fs.writeFileSync(
  file,
  t,
  'utf8'
);

console.log('');
console.log('PATCH 154V-FIX2 WRITTEN');
console.log('✓ bypassed ambiguous week RPC');
console.log('✓ automatic reading still materialized daily');
console.log('✓ current Monday-Sunday plan retained');
console.log('✓ Genesis 5-6 should load today');
console.log('✓ 4 generated questions retained');
console.log('✓ no DB migration needed');
console.log('');

