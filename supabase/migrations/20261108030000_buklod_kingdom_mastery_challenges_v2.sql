-- BUKLOD Kingdom Mastery Check V2: a separate server-scored skill challenge
-- for each of the 39 catalog games. NEVER claims to verify client gameplay score.
-- +2 BP ONLY on first server-verified 3/3 correct check per account and game.
-- The separate skill check does NOT attest to original gameplay victory. Members
-- see this distinction before participating. No untrusted win result can award BP.
-- Character levels/items update from the existing claimed lifetime Points ledger.
create table if not exists private.buklod_kingdom_mastery_catalog_v1(
 game_id text primary key, title text not null, genre text not null,
 character_id text not null, active boolean not null default true
);
revoke all on private.buklod_kingdom_mastery_catalog_v1 from public,anon,authenticated;
alter table private.buklod_kingdom_mastery_catalog_v1 enable row level security;
insert into private.buklod_kingdom_mastery_catalog_v1(game_id,title,genre,character_id,active) values
('phan-enterprise-builder','Enterprise Builder','simulation','phan',true),
('phan-trade-master','Trade Master','trading','phan',true),
('phan-market-match','Market Match','match3','phan',true),
('quin-discovery-expedition','Discovery Expedition','exploration','quin',true),
('quin-guessing-quest','Guessing Quest','quiz','quin',true),
('quin-code-breaker','Code Breaker','logic','quin',true),
('van-living-city-dispatch','City Dispatch','strategy','van',true),
('van-sudoku-master','Sudoku Master','numbers','van',true),
('van-mind-challenge','Mind Challenge','logic','van',true),
('christian-civic-leadership','Leadership Council','strategy','christian',true),
('christian-bible-crown','Bible Crown','quiz','christian',true),
('christian-scripture-word-search','Scripture Word Search','words','christian',true),
('lhen-rhythm-journey','Rhythm Journey','rhythm','lhen',true),
('lhen-melody-memory','Melody Memory','memory','lhen',true),
('lhen-beat-composer','Beat Composer','rhythm','lhen',true),
('jawo-forest-trail','Forest Trail','action','jawo',true),
('jawo-trail-maze','Trail Maze','maze','jawo',true),
('jawo-nature-match','Nature Match','match3','jawo',true),
('trudice-playground-memory','Wonder Path','memory','trudice',true),
('trudice-picture-pairs','Picture Pairs','memory','trudice',true),
('trudice-word-garden','Word Garden','words','trudice',true),
('ace-rescue-grid','Rescue Grid','strategy','ace',true),
('ace-chess-master','Chess Master','chess','ace',true),
('ace-tower-tactics','Tower Tactics','strategy','ace',true),
('mitch-restore-mural','Restore the Mural','art','mitch',true),
('mitch-block-forge','Block Forge','blocks','mitch',true),
('mitch-color-merge','Color Merge','merge','mitch',true),
('niel-mission-trail','Mission Trail','simulation','niel',true),
('niel-expedition-puzzle','Expedition Puzzle','strategy','niel',true),
('niel-word-explorer','Word Explorer','words','niel',true),
('angel-kingdom-treasury','Kingdom Treasury','simulation','angel',true),
('angel-number-vault','Number Vault','numbers','angel',true),
('angel-treasure-merge','Treasure Merge','merge','angel',true),
('vhen-farm-to-market','Farm to Market','simulation','vhen',true),
('vhen-harvest-match','Harvest Match','match3','vhen',true),
('vhen-farm-merge','Farm Merge','merge','vhen',true),
('elesur-village-builder','Village Builder','simulation','ellusur',true),
('elesur-domino-village','Domino Village','domino','ellusur',true),
('elesur-bridge-puzzle','Bridge Puzzle','logic','ellusur',true)
on conflict(game_id) do update set title=excluded.title,genre=excluded.genre,character_id=excluded.character_id;

create table if not exists private.buklod_kingdom_mastery_bank_v1(
 game_id text not null references private.buklod_kingdom_mastery_catalog_v1(game_id),
 question_no integer not null check(question_no between 1 and 20),
 prompt text not null,
 choices jsonb not null check(jsonb_typeof(choices)='array' and jsonb_array_length(choices)=4),
 answer_index integer not null check(answer_index between 0 and 3),
 primary key(game_id,question_no)
);
revoke all on private.buklod_kingdom_mastery_bank_v1 from public,anon,authenticated;
alter table private.buklod_kingdom_mastery_bank_v1 enable row level security;
insert into private.buklod_kingdom_mastery_bank_v1(game_id,question_no,prompt,choices,answer_index) values
('phan-enterprise-builder',1,'Enterprise Builder — Which approach best protects limited resources?','["Plan before spending","Spend everything immediately","Ignore objectives","Repeat a losing move"]'::jsonb,0),
('phan-enterprise-builder',2,'Enterprise Builder — A path offers a safe move and an unknown risky move. What is a prudent first step?','["Check the consequences","Choose blindly","Discard all information","Skip the objective"]'::jsonb,0),
('phan-enterprise-builder',3,'Enterprise Builder — To finish a strategy objective, what must be tracked?','["Progress and remaining resources","Only the background color","Only the music volume","Only the last tap"]'::jsonb,0),
('phan-enterprise-builder',4,'Enterprise Builder — What should you do when a plan repeatedly fails?','["Review evidence and adjust","Repeat without learning","Hide the result","Ignore constraints"]'::jsonb,0),
('phan-enterprise-builder',5,'Enterprise Builder — Which choice avoids an impossible commitment?','["Check required resources first","Commit without inventory","Spend twice the budget","Assume infinite turns"]'::jsonb,0),
('phan-trade-master',1,'Trade Master — Which approach best protects limited resources?','["Plan before spending","Spend everything immediately","Ignore objectives","Repeat a losing move"]'::jsonb,0),
('phan-trade-master',2,'Trade Master — A path offers a safe move and an unknown risky move. What is a prudent first step?','["Check the consequences","Choose blindly","Discard all information","Skip the objective"]'::jsonb,0),
('phan-trade-master',3,'Trade Master — To finish a strategy objective, what must be tracked?','["Progress and remaining resources","Only the background color","Only the music volume","Only the last tap"]'::jsonb,0),
('phan-trade-master',4,'Trade Master — What should you do when a plan repeatedly fails?','["Review evidence and adjust","Repeat without learning","Hide the result","Ignore constraints"]'::jsonb,0),
('phan-trade-master',5,'Trade Master — Which choice avoids an impossible commitment?','["Check required resources first","Commit without inventory","Spend twice the budget","Assume infinite turns"]'::jsonb,0),
('phan-market-match',1,'Market Match — To solve a puzzle consistently, what should be checked first?','["The stated rules","A random shortcut","Only the score","Only the background"]'::jsonb,0),
('phan-market-match',2,'Market Match — Which pattern follows alternating symbols: A, B, A, B, ...?','["A","B","C","D"]'::jsonb,0),
('phan-market-match',3,'Market Match — If 3 pieces fill a row of 5 spaces, how many empty spaces remain?','["2","3","5","8"]'::jsonb,0),
('phan-market-match',4,'Market Match — Which move reduces an avoidable mistake?','["Check constraints before moving","Make two moves without looking","Ignore occupied cells","Reset after every tap"]'::jsonb,0),
('phan-market-match',5,'Market Match — What comes after N, E, S in a clockwise direction sequence?','["W","N","E","S"]'::jsonb,0),
('quin-discovery-expedition',1,'Discovery Expedition — A route splits at a marked crossroads. Which is safer?','["Consult the map and signs","Choose at random","Ignore the marker","Travel without a plan"]'::jsonb,0),
('quin-discovery-expedition',2,'Discovery Expedition — What is the opposite direction of north?','["South","West","East","North"]'::jsonb,0),
('quin-discovery-expedition',3,'Discovery Expedition — Facing east, a left turn points ...','["North","South","West","East"]'::jsonb,0),
('quin-discovery-expedition',4,'Discovery Expedition — Which sequence forms a clockwise compass?','["N-E-S-W","N-W-S-E","E-N-W-S","S-E-N-W"]'::jsonb,0),
('quin-discovery-expedition',5,'Discovery Expedition — Which action helps preserve supplies on a long journey?','["Plan stops and resources","Carry nothing","Ignore distance","Repeat a blocked route"]'::jsonb,0),
('quin-guessing-quest',1,'Guessing Quest — Which word means working together toward one goal?','["Collaboration","Isolation","Confusion","Avoidance"]'::jsonb,0),
('quin-guessing-quest',2,'Guessing Quest — Which word is the opposite of ''rare''?','["Common","Scarce","Unique","Unusual"]'::jsonb,0),
('quin-guessing-quest',3,'Guessing Quest — How many letters are in the word ''KINGDOM''?','["7","6","8","9"]'::jsonb,0),
('quin-guessing-quest',4,'Guessing Quest — Choose the correctly spelled word.','["Achievement","Acheivement","Achievment","Acheevement"]'::jsonb,0),
('quin-guessing-quest',5,'Guessing Quest — Which word means a careful examination?','["Inspection","Guess","Distraction","Shortcut"]'::jsonb,0),
('quin-code-breaker',1,'Code Breaker — To solve a puzzle consistently, what should be checked first?','["The stated rules","A random shortcut","Only the score","Only the background"]'::jsonb,0),
('quin-code-breaker',2,'Code Breaker — Which pattern follows alternating symbols: A, B, A, B, ...?','["A","B","C","D"]'::jsonb,0),
('quin-code-breaker',3,'Code Breaker — If 3 pieces fill a row of 5 spaces, how many empty spaces remain?','["2","3","5","8"]'::jsonb,0),
('quin-code-breaker',4,'Code Breaker — Which move reduces an avoidable mistake?','["Check constraints before moving","Make two moves without looking","Ignore occupied cells","Reset after every tap"]'::jsonb,0),
('quin-code-breaker',5,'Code Breaker — What comes after N, E, S in a clockwise direction sequence?','["W","N","E","S"]'::jsonb,0),
('van-living-city-dispatch',1,'City Dispatch — Which approach best protects limited resources?','["Plan before spending","Spend everything immediately","Ignore objectives","Repeat a losing move"]'::jsonb,0),
('van-living-city-dispatch',2,'City Dispatch — A path offers a safe move and an unknown risky move. What is a prudent first step?','["Check the consequences","Choose blindly","Discard all information","Skip the objective"]'::jsonb,0),
('van-living-city-dispatch',3,'City Dispatch — To finish a strategy objective, what must be tracked?','["Progress and remaining resources","Only the background color","Only the music volume","Only the last tap"]'::jsonb,0),
('van-living-city-dispatch',4,'City Dispatch — What should you do when a plan repeatedly fails?','["Review evidence and adjust","Repeat without learning","Hide the result","Ignore constraints"]'::jsonb,0),
('van-living-city-dispatch',5,'City Dispatch — Which choice avoids an impossible commitment?','["Check required resources first","Commit without inventory","Spend twice the budget","Assume infinite turns"]'::jsonb,0),
('van-sudoku-master',1,'Sudoku Master — What comes next: 3, 6, 9, 12, ...?','["15","14","17","21"]'::jsonb,0),
('van-sudoku-master',2,'Sudoku Master — What is 7 multiplied by 6?','["42","36","48","56"]'::jsonb,0),
('van-sudoku-master',3,'Sudoku Master — What is the next number: 2, 4, 8, 16, ...?','["32","24","30","64"]'::jsonb,0),
('van-sudoku-master',4,'Sudoku Master — Which number is the odd one out: 4, 8, 12, 15?','["15","4","8","12"]'::jsonb,0),
('van-sudoku-master',5,'Sudoku Master — What is 25% of 80?','["20","15","30","40"]'::jsonb,0),
('van-mind-challenge',1,'Mind Challenge — To solve a puzzle consistently, what should be checked first?','["The stated rules","A random shortcut","Only the score","Only the background"]'::jsonb,0),
('van-mind-challenge',2,'Mind Challenge — Which pattern follows alternating symbols: A, B, A, B, ...?','["A","B","C","D"]'::jsonb,0),
('van-mind-challenge',3,'Mind Challenge — If 3 pieces fill a row of 5 spaces, how many empty spaces remain?','["2","3","5","8"]'::jsonb,0),
('van-mind-challenge',4,'Mind Challenge — Which move reduces an avoidable mistake?','["Check constraints before moving","Make two moves without looking","Ignore occupied cells","Reset after every tap"]'::jsonb,0),
('van-mind-challenge',5,'Mind Challenge — What comes after N, E, S in a clockwise direction sequence?','["W","N","E","S"]'::jsonb,0),
('christian-civic-leadership',1,'Leadership Council — Which approach best protects limited resources?','["Plan before spending","Spend everything immediately","Ignore objectives","Repeat a losing move"]'::jsonb,0),
('christian-civic-leadership',2,'Leadership Council — A path offers a safe move and an unknown risky move. What is a prudent first step?','["Check the consequences","Choose blindly","Discard all information","Skip the objective"]'::jsonb,0),
('christian-civic-leadership',3,'Leadership Council — To finish a strategy objective, what must be tracked?','["Progress and remaining resources","Only the background color","Only the music volume","Only the last tap"]'::jsonb,0),
('christian-civic-leadership',4,'Leadership Council — What should you do when a plan repeatedly fails?','["Review evidence and adjust","Repeat without learning","Hide the result","Ignore constraints"]'::jsonb,0),
('christian-civic-leadership',5,'Leadership Council — Which choice avoids an impossible commitment?','["Check required resources first","Commit without inventory","Spend twice the budget","Assume infinite turns"]'::jsonb,0),
('christian-bible-crown',1,'Bible Crown — Which word means working together toward one goal?','["Collaboration","Isolation","Confusion","Avoidance"]'::jsonb,0),
('christian-bible-crown',2,'Bible Crown — Which word is the opposite of ''rare''?','["Common","Scarce","Unique","Unusual"]'::jsonb,0),
('christian-bible-crown',3,'Bible Crown — How many letters are in the word ''KINGDOM''?','["7","6","8","9"]'::jsonb,0),
('christian-bible-crown',4,'Bible Crown — Choose the correctly spelled word.','["Achievement","Acheivement","Achievment","Acheevement"]'::jsonb,0),
('christian-bible-crown',5,'Bible Crown — Which word means a careful examination?','["Inspection","Guess","Distraction","Shortcut"]'::jsonb,0),
('christian-scripture-word-search',1,'Scripture Word Search — Which word means working together toward one goal?','["Collaboration","Isolation","Confusion","Avoidance"]'::jsonb,0),
('christian-scripture-word-search',2,'Scripture Word Search — Which word is the opposite of ''rare''?','["Common","Scarce","Unique","Unusual"]'::jsonb,0),
('christian-scripture-word-search',3,'Scripture Word Search — How many letters are in the word ''KINGDOM''?','["7","6","8","9"]'::jsonb,0),
('christian-scripture-word-search',4,'Scripture Word Search — Choose the correctly spelled word.','["Achievement","Acheivement","Achievment","Acheevement"]'::jsonb,0),
('christian-scripture-word-search',5,'Scripture Word Search — Which word means a careful examination?','["Inspection","Guess","Distraction","Shortcut"]'::jsonb,0),
('lhen-rhythm-journey',1,'Rhythm Journey — Four quarter-note beats in a 4/4 measure total how many beats?','["4","2","6","8"]'::jsonb,0),
('lhen-rhythm-journey',2,'Rhythm Journey — Which musical term describes speed?','["Tempo","Pitch","Harmony","Timbre"]'::jsonb,0),
('lhen-rhythm-journey',3,'Rhythm Journey — How many eighth notes equal one quarter note?','["2","1","3","4"]'::jsonb,0),
('lhen-rhythm-journey',4,'Rhythm Journey — If a rhythm repeats every 3 beats, how many beats are in 4 cycles?','["12","7","9","16"]'::jsonb,0),
('lhen-rhythm-journey',5,'Rhythm Journey — Which action supports accurate rhythm timing?','["Follow a steady pulse","Tap randomly","Ignore rests","Change speed constantly"]'::jsonb,0),
('lhen-melody-memory',1,'Melody Memory — What helps recall a sequence most reliably?','["Group related items","Skip attention","Shuffle while memorizing","Erase each clue"]'::jsonb,0),
('lhen-melody-memory',2,'Melody Memory — Read: SUN, RIVER, TREE. Which was second?','["RIVER","SUN","TREE","STONE"]'::jsonb,0),
('lhen-melody-memory',3,'Melody Memory — Read: BLUE, RED, GOLD. Which was last?','["GOLD","BLUE","RED","GREEN"]'::jsonb,0),
('lhen-melody-memory',4,'Melody Memory — Which action improves remembering a picture pattern?','["Notice positions and differences","Look away before starting","Press any tile","Ignore the image"]'::jsonb,0),
('lhen-melody-memory',5,'Melody Memory — A sequence is 1, 3, 5. What comes next?','["7","6","8","9"]'::jsonb,0),
('lhen-beat-composer',1,'Beat Composer — Four quarter-note beats in a 4/4 measure total how many beats?','["4","2","6","8"]'::jsonb,0),
('lhen-beat-composer',2,'Beat Composer — Which musical term describes speed?','["Tempo","Pitch","Harmony","Timbre"]'::jsonb,0),
('lhen-beat-composer',3,'Beat Composer — How many eighth notes equal one quarter note?','["2","1","3","4"]'::jsonb,0),
('lhen-beat-composer',4,'Beat Composer — If a rhythm repeats every 3 beats, how many beats are in 4 cycles?','["12","7","9","16"]'::jsonb,0),
('lhen-beat-composer',5,'Beat Composer — Which action supports accurate rhythm timing?','["Follow a steady pulse","Tap randomly","Ignore rests","Change speed constantly"]'::jsonb,0),
('jawo-forest-trail',1,'Forest Trail — A route splits at a marked crossroads. Which is safer?','["Consult the map and signs","Choose at random","Ignore the marker","Travel without a plan"]'::jsonb,0),
('jawo-forest-trail',2,'Forest Trail — What is the opposite direction of north?','["South","West","East","North"]'::jsonb,0),
('jawo-forest-trail',3,'Forest Trail — Facing east, a left turn points ...','["North","South","West","East"]'::jsonb,0),
('jawo-forest-trail',4,'Forest Trail — Which sequence forms a clockwise compass?','["N-E-S-W","N-W-S-E","E-N-W-S","S-E-N-W"]'::jsonb,0),
('jawo-forest-trail',5,'Forest Trail — Which action helps preserve supplies on a long journey?','["Plan stops and resources","Carry nothing","Ignore distance","Repeat a blocked route"]'::jsonb,0),
('jawo-trail-maze',1,'Trail Maze — A route splits at a marked crossroads. Which is safer?','["Consult the map and signs","Choose at random","Ignore the marker","Travel without a plan"]'::jsonb,0),
('jawo-trail-maze',2,'Trail Maze — What is the opposite direction of north?','["South","West","East","North"]'::jsonb,0),
('jawo-trail-maze',3,'Trail Maze — Facing east, a left turn points ...','["North","South","West","East"]'::jsonb,0),
('jawo-trail-maze',4,'Trail Maze — Which sequence forms a clockwise compass?','["N-E-S-W","N-W-S-E","E-N-W-S","S-E-N-W"]'::jsonb,0),
('jawo-trail-maze',5,'Trail Maze — Which action helps preserve supplies on a long journey?','["Plan stops and resources","Carry nothing","Ignore distance","Repeat a blocked route"]'::jsonb,0),
('jawo-nature-match',1,'Nature Match — To solve a puzzle consistently, what should be checked first?','["The stated rules","A random shortcut","Only the score","Only the background"]'::jsonb,0),
('jawo-nature-match',2,'Nature Match — Which pattern follows alternating symbols: A, B, A, B, ...?','["A","B","C","D"]'::jsonb,0),
('jawo-nature-match',3,'Nature Match — If 3 pieces fill a row of 5 spaces, how many empty spaces remain?','["2","3","5","8"]'::jsonb,0),
('jawo-nature-match',4,'Nature Match — Which move reduces an avoidable mistake?','["Check constraints before moving","Make two moves without looking","Ignore occupied cells","Reset after every tap"]'::jsonb,0),
('jawo-nature-match',5,'Nature Match — What comes after N, E, S in a clockwise direction sequence?','["W","N","E","S"]'::jsonb,0),
('trudice-playground-memory',1,'Wonder Path — What helps recall a sequence most reliably?','["Group related items","Skip attention","Shuffle while memorizing","Erase each clue"]'::jsonb,0),
('trudice-playground-memory',2,'Wonder Path — Read: SUN, RIVER, TREE. Which was second?','["RIVER","SUN","TREE","STONE"]'::jsonb,0),
('trudice-playground-memory',3,'Wonder Path — Read: BLUE, RED, GOLD. Which was last?','["GOLD","BLUE","RED","GREEN"]'::jsonb,0),
('trudice-playground-memory',4,'Wonder Path — Which action improves remembering a picture pattern?','["Notice positions and differences","Look away before starting","Press any tile","Ignore the image"]'::jsonb,0),
('trudice-playground-memory',5,'Wonder Path — A sequence is 1, 3, 5. What comes next?','["7","6","8","9"]'::jsonb,0),
('trudice-picture-pairs',1,'Picture Pairs — What helps recall a sequence most reliably?','["Group related items","Skip attention","Shuffle while memorizing","Erase each clue"]'::jsonb,0),
('trudice-picture-pairs',2,'Picture Pairs — Read: SUN, RIVER, TREE. Which was second?','["RIVER","SUN","TREE","STONE"]'::jsonb,0),
('trudice-picture-pairs',3,'Picture Pairs — Read: BLUE, RED, GOLD. Which was last?','["GOLD","BLUE","RED","GREEN"]'::jsonb,0),
('trudice-picture-pairs',4,'Picture Pairs — Which action improves remembering a picture pattern?','["Notice positions and differences","Look away before starting","Press any tile","Ignore the image"]'::jsonb,0),
('trudice-picture-pairs',5,'Picture Pairs — A sequence is 1, 3, 5. What comes next?','["7","6","8","9"]'::jsonb,0),
('trudice-word-garden',1,'Word Garden — Which word means working together toward one goal?','["Collaboration","Isolation","Confusion","Avoidance"]'::jsonb,0),
('trudice-word-garden',2,'Word Garden — Which word is the opposite of ''rare''?','["Common","Scarce","Unique","Unusual"]'::jsonb,0),
('trudice-word-garden',3,'Word Garden — How many letters are in the word ''KINGDOM''?','["7","6","8","9"]'::jsonb,0),
('trudice-word-garden',4,'Word Garden — Choose the correctly spelled word.','["Achievement","Acheivement","Achievment","Acheevement"]'::jsonb,0),
('trudice-word-garden',5,'Word Garden — Which word means a careful examination?','["Inspection","Guess","Distraction","Shortcut"]'::jsonb,0),
('ace-rescue-grid',1,'Rescue Grid — Which approach best protects limited resources?','["Plan before spending","Spend everything immediately","Ignore objectives","Repeat a losing move"]'::jsonb,0),
('ace-rescue-grid',2,'Rescue Grid — A path offers a safe move and an unknown risky move. What is a prudent first step?','["Check the consequences","Choose blindly","Discard all information","Skip the objective"]'::jsonb,0),
('ace-rescue-grid',3,'Rescue Grid — To finish a strategy objective, what must be tracked?','["Progress and remaining resources","Only the background color","Only the music volume","Only the last tap"]'::jsonb,0),
('ace-rescue-grid',4,'Rescue Grid — What should you do when a plan repeatedly fails?','["Review evidence and adjust","Repeat without learning","Hide the result","Ignore constraints"]'::jsonb,0),
('ace-rescue-grid',5,'Rescue Grid — Which choice avoids an impossible commitment?','["Check required resources first","Commit without inventory","Spend twice the budget","Assume infinite turns"]'::jsonb,0),
('ace-chess-master',1,'Chess Master — Which approach best protects limited resources?','["Plan before spending","Spend everything immediately","Ignore objectives","Repeat a losing move"]'::jsonb,0),
('ace-chess-master',2,'Chess Master — A path offers a safe move and an unknown risky move. What is a prudent first step?','["Check the consequences","Choose blindly","Discard all information","Skip the objective"]'::jsonb,0),
('ace-chess-master',3,'Chess Master — To finish a strategy objective, what must be tracked?','["Progress and remaining resources","Only the background color","Only the music volume","Only the last tap"]'::jsonb,0),
('ace-chess-master',4,'Chess Master — What should you do when a plan repeatedly fails?','["Review evidence and adjust","Repeat without learning","Hide the result","Ignore constraints"]'::jsonb,0),
('ace-chess-master',5,'Chess Master — Which choice avoids an impossible commitment?','["Check required resources first","Commit without inventory","Spend twice the budget","Assume infinite turns"]'::jsonb,0),
('ace-tower-tactics',1,'Tower Tactics — Which approach best protects limited resources?','["Plan before spending","Spend everything immediately","Ignore objectives","Repeat a losing move"]'::jsonb,0),
('ace-tower-tactics',2,'Tower Tactics — A path offers a safe move and an unknown risky move. What is a prudent first step?','["Check the consequences","Choose blindly","Discard all information","Skip the objective"]'::jsonb,0),
('ace-tower-tactics',3,'Tower Tactics — To finish a strategy objective, what must be tracked?','["Progress and remaining resources","Only the background color","Only the music volume","Only the last tap"]'::jsonb,0),
('ace-tower-tactics',4,'Tower Tactics — What should you do when a plan repeatedly fails?','["Review evidence and adjust","Repeat without learning","Hide the result","Ignore constraints"]'::jsonb,0),
('ace-tower-tactics',5,'Tower Tactics — Which choice avoids an impossible commitment?','["Check required resources first","Commit without inventory","Spend twice the budget","Assume infinite turns"]'::jsonb,0),
('mitch-restore-mural',1,'Restore the Mural — Which colors mix to make green in a basic paint palette?','["Blue and yellow","Red and blue","Red and white","Black and red"]'::jsonb,0),
('mitch-restore-mural',2,'Restore the Mural — Which pair offers strong light-dark contrast?','["White and black","White and cream","Navy and dark blue","Yellow and gold"]'::jsonb,0),
('mitch-restore-mural',3,'Restore the Mural — A repeating visual design is called a ...','["Pattern","Glitch","Pause","Score"]'::jsonb,0),
('mitch-restore-mural',4,'Restore the Mural — Which action preserves an original image while experimenting?','["Save a copy first","Overwrite without saving","Discard all layers","Remove the reference"]'::jsonb,0),
('mitch-restore-mural',5,'Restore the Mural — Which principle helps balance a design?','["Visual weight","Random cropping","Uneven hidden text","Ignoring alignment"]'::jsonb,0),
('mitch-block-forge',1,'Block Forge — To solve a puzzle consistently, what should be checked first?','["The stated rules","A random shortcut","Only the score","Only the background"]'::jsonb,0),
('mitch-block-forge',2,'Block Forge — Which pattern follows alternating symbols: A, B, A, B, ...?','["A","B","C","D"]'::jsonb,0),
('mitch-block-forge',3,'Block Forge — If 3 pieces fill a row of 5 spaces, how many empty spaces remain?','["2","3","5","8"]'::jsonb,0),
('mitch-block-forge',4,'Block Forge — Which move reduces an avoidable mistake?','["Check constraints before moving","Make two moves without looking","Ignore occupied cells","Reset after every tap"]'::jsonb,0),
('mitch-block-forge',5,'Block Forge — What comes after N, E, S in a clockwise direction sequence?','["W","N","E","S"]'::jsonb,0),
('mitch-color-merge',1,'Color Merge — To solve a puzzle consistently, what should be checked first?','["The stated rules","A random shortcut","Only the score","Only the background"]'::jsonb,0),
('mitch-color-merge',2,'Color Merge — Which pattern follows alternating symbols: A, B, A, B, ...?','["A","B","C","D"]'::jsonb,0),
('mitch-color-merge',3,'Color Merge — If 3 pieces fill a row of 5 spaces, how many empty spaces remain?','["2","3","5","8"]'::jsonb,0),
('mitch-color-merge',4,'Color Merge — Which move reduces an avoidable mistake?','["Check constraints before moving","Make two moves without looking","Ignore occupied cells","Reset after every tap"]'::jsonb,0),
('mitch-color-merge',5,'Color Merge — What comes after N, E, S in a clockwise direction sequence?','["W","N","E","S"]'::jsonb,0),
('niel-mission-trail',1,'Mission Trail — Which approach best protects limited resources?','["Plan before spending","Spend everything immediately","Ignore objectives","Repeat a losing move"]'::jsonb,0),
('niel-mission-trail',2,'Mission Trail — A path offers a safe move and an unknown risky move. What is a prudent first step?','["Check the consequences","Choose blindly","Discard all information","Skip the objective"]'::jsonb,0),
('niel-mission-trail',3,'Mission Trail — To finish a strategy objective, what must be tracked?','["Progress and remaining resources","Only the background color","Only the music volume","Only the last tap"]'::jsonb,0),
('niel-mission-trail',4,'Mission Trail — What should you do when a plan repeatedly fails?','["Review evidence and adjust","Repeat without learning","Hide the result","Ignore constraints"]'::jsonb,0),
('niel-mission-trail',5,'Mission Trail — Which choice avoids an impossible commitment?','["Check required resources first","Commit without inventory","Spend twice the budget","Assume infinite turns"]'::jsonb,0),
('niel-expedition-puzzle',1,'Expedition Puzzle — Which approach best protects limited resources?','["Plan before spending","Spend everything immediately","Ignore objectives","Repeat a losing move"]'::jsonb,0),
('niel-expedition-puzzle',2,'Expedition Puzzle — A path offers a safe move and an unknown risky move. What is a prudent first step?','["Check the consequences","Choose blindly","Discard all information","Skip the objective"]'::jsonb,0),
('niel-expedition-puzzle',3,'Expedition Puzzle — To finish a strategy objective, what must be tracked?','["Progress and remaining resources","Only the background color","Only the music volume","Only the last tap"]'::jsonb,0),
('niel-expedition-puzzle',4,'Expedition Puzzle — What should you do when a plan repeatedly fails?','["Review evidence and adjust","Repeat without learning","Hide the result","Ignore constraints"]'::jsonb,0),
('niel-expedition-puzzle',5,'Expedition Puzzle — Which choice avoids an impossible commitment?','["Check required resources first","Commit without inventory","Spend twice the budget","Assume infinite turns"]'::jsonb,0),
('niel-word-explorer',1,'Word Explorer — Which word means working together toward one goal?','["Collaboration","Isolation","Confusion","Avoidance"]'::jsonb,0),
('niel-word-explorer',2,'Word Explorer — Which word is the opposite of ''rare''?','["Common","Scarce","Unique","Unusual"]'::jsonb,0),
('niel-word-explorer',3,'Word Explorer — How many letters are in the word ''KINGDOM''?','["7","6","8","9"]'::jsonb,0),
('niel-word-explorer',4,'Word Explorer — Choose the correctly spelled word.','["Achievement","Acheivement","Achievment","Acheevement"]'::jsonb,0),
('niel-word-explorer',5,'Word Explorer — Which word means a careful examination?','["Inspection","Guess","Distraction","Shortcut"]'::jsonb,0),
('angel-kingdom-treasury',1,'Kingdom Treasury — Which approach best protects limited resources?','["Plan before spending","Spend everything immediately","Ignore objectives","Repeat a losing move"]'::jsonb,0),
('angel-kingdom-treasury',2,'Kingdom Treasury — A path offers a safe move and an unknown risky move. What is a prudent first step?','["Check the consequences","Choose blindly","Discard all information","Skip the objective"]'::jsonb,0),
('angel-kingdom-treasury',3,'Kingdom Treasury — To finish a strategy objective, what must be tracked?','["Progress and remaining resources","Only the background color","Only the music volume","Only the last tap"]'::jsonb,0),
('angel-kingdom-treasury',4,'Kingdom Treasury — What should you do when a plan repeatedly fails?','["Review evidence and adjust","Repeat without learning","Hide the result","Ignore constraints"]'::jsonb,0),
('angel-kingdom-treasury',5,'Kingdom Treasury — Which choice avoids an impossible commitment?','["Check required resources first","Commit without inventory","Spend twice the budget","Assume infinite turns"]'::jsonb,0),
('angel-number-vault',1,'Number Vault — What comes next: 3, 6, 9, 12, ...?','["15","14","17","21"]'::jsonb,0),
('angel-number-vault',2,'Number Vault — What is 7 multiplied by 6?','["42","36","48","56"]'::jsonb,0),
('angel-number-vault',3,'Number Vault — What is the next number: 2, 4, 8, 16, ...?','["32","24","30","64"]'::jsonb,0),
('angel-number-vault',4,'Number Vault — Which number is the odd one out: 4, 8, 12, 15?','["15","4","8","12"]'::jsonb,0),
('angel-number-vault',5,'Number Vault — What is 25% of 80?','["20","15","30","40"]'::jsonb,0),
('angel-treasure-merge',1,'Treasure Merge — To solve a puzzle consistently, what should be checked first?','["The stated rules","A random shortcut","Only the score","Only the background"]'::jsonb,0),
('angel-treasure-merge',2,'Treasure Merge — Which pattern follows alternating symbols: A, B, A, B, ...?','["A","B","C","D"]'::jsonb,0),
('angel-treasure-merge',3,'Treasure Merge — If 3 pieces fill a row of 5 spaces, how many empty spaces remain?','["2","3","5","8"]'::jsonb,0),
('angel-treasure-merge',4,'Treasure Merge — Which move reduces an avoidable mistake?','["Check constraints before moving","Make two moves without looking","Ignore occupied cells","Reset after every tap"]'::jsonb,0),
('angel-treasure-merge',5,'Treasure Merge — What comes after N, E, S in a clockwise direction sequence?','["W","N","E","S"]'::jsonb,0),
('vhen-farm-to-market',1,'Farm to Market — Which approach best protects limited resources?','["Plan before spending","Spend everything immediately","Ignore objectives","Repeat a losing move"]'::jsonb,0),
('vhen-farm-to-market',2,'Farm to Market — A path offers a safe move and an unknown risky move. What is a prudent first step?','["Check the consequences","Choose blindly","Discard all information","Skip the objective"]'::jsonb,0),
('vhen-farm-to-market',3,'Farm to Market — To finish a strategy objective, what must be tracked?','["Progress and remaining resources","Only the background color","Only the music volume","Only the last tap"]'::jsonb,0),
('vhen-farm-to-market',4,'Farm to Market — What should you do when a plan repeatedly fails?','["Review evidence and adjust","Repeat without learning","Hide the result","Ignore constraints"]'::jsonb,0),
('vhen-farm-to-market',5,'Farm to Market — Which choice avoids an impossible commitment?','["Check required resources first","Commit without inventory","Spend twice the budget","Assume infinite turns"]'::jsonb,0),
('vhen-harvest-match',1,'Harvest Match — To solve a puzzle consistently, what should be checked first?','["The stated rules","A random shortcut","Only the score","Only the background"]'::jsonb,0),
('vhen-harvest-match',2,'Harvest Match — Which pattern follows alternating symbols: A, B, A, B, ...?','["A","B","C","D"]'::jsonb,0),
('vhen-harvest-match',3,'Harvest Match — If 3 pieces fill a row of 5 spaces, how many empty spaces remain?','["2","3","5","8"]'::jsonb,0),
('vhen-harvest-match',4,'Harvest Match — Which move reduces an avoidable mistake?','["Check constraints before moving","Make two moves without looking","Ignore occupied cells","Reset after every tap"]'::jsonb,0),
('vhen-harvest-match',5,'Harvest Match — What comes after N, E, S in a clockwise direction sequence?','["W","N","E","S"]'::jsonb,0),
('vhen-farm-merge',1,'Farm Merge — To solve a puzzle consistently, what should be checked first?','["The stated rules","A random shortcut","Only the score","Only the background"]'::jsonb,0),
('vhen-farm-merge',2,'Farm Merge — Which pattern follows alternating symbols: A, B, A, B, ...?','["A","B","C","D"]'::jsonb,0),
('vhen-farm-merge',3,'Farm Merge — If 3 pieces fill a row of 5 spaces, how many empty spaces remain?','["2","3","5","8"]'::jsonb,0),
('vhen-farm-merge',4,'Farm Merge — Which move reduces an avoidable mistake?','["Check constraints before moving","Make two moves without looking","Ignore occupied cells","Reset after every tap"]'::jsonb,0),
('vhen-farm-merge',5,'Farm Merge — What comes after N, E, S in a clockwise direction sequence?','["W","N","E","S"]'::jsonb,0),
('elesur-village-builder',1,'Village Builder — Which approach best protects limited resources?','["Plan before spending","Spend everything immediately","Ignore objectives","Repeat a losing move"]'::jsonb,0),
('elesur-village-builder',2,'Village Builder — A path offers a safe move and an unknown risky move. What is a prudent first step?','["Check the consequences","Choose blindly","Discard all information","Skip the objective"]'::jsonb,0),
('elesur-village-builder',3,'Village Builder — To finish a strategy objective, what must be tracked?','["Progress and remaining resources","Only the background color","Only the music volume","Only the last tap"]'::jsonb,0),
('elesur-village-builder',4,'Village Builder — What should you do when a plan repeatedly fails?','["Review evidence and adjust","Repeat without learning","Hide the result","Ignore constraints"]'::jsonb,0),
('elesur-village-builder',5,'Village Builder — Which choice avoids an impossible commitment?','["Check required resources first","Commit without inventory","Spend twice the budget","Assume infinite turns"]'::jsonb,0),
('elesur-domino-village',1,'Domino Village — To solve a puzzle consistently, what should be checked first?','["The stated rules","A random shortcut","Only the score","Only the background"]'::jsonb,0),
('elesur-domino-village',2,'Domino Village — Which pattern follows alternating symbols: A, B, A, B, ...?','["A","B","C","D"]'::jsonb,0),
('elesur-domino-village',3,'Domino Village — If 3 pieces fill a row of 5 spaces, how many empty spaces remain?','["2","3","5","8"]'::jsonb,0),
('elesur-domino-village',4,'Domino Village — Which move reduces an avoidable mistake?','["Check constraints before moving","Make two moves without looking","Ignore occupied cells","Reset after every tap"]'::jsonb,0),
('elesur-domino-village',5,'Domino Village — What comes after N, E, S in a clockwise direction sequence?','["W","N","E","S"]'::jsonb,0),
('elesur-bridge-puzzle',1,'Bridge Puzzle — To solve a puzzle consistently, what should be checked first?','["The stated rules","A random shortcut","Only the score","Only the background"]'::jsonb,0),
('elesur-bridge-puzzle',2,'Bridge Puzzle — Which pattern follows alternating symbols: A, B, A, B, ...?','["A","B","C","D"]'::jsonb,0),
('elesur-bridge-puzzle',3,'Bridge Puzzle — If 3 pieces fill a row of 5 spaces, how many empty spaces remain?','["2","3","5","8"]'::jsonb,0),
('elesur-bridge-puzzle',4,'Bridge Puzzle — Which move reduces an avoidable mistake?','["Check constraints before moving","Make two moves without looking","Ignore occupied cells","Reset after every tap"]'::jsonb,0),
('elesur-bridge-puzzle',5,'Bridge Puzzle — What comes after N, E, S in a clockwise direction sequence?','["W","N","E","S"]'::jsonb,0)
on conflict(game_id,question_no) do update set prompt=excluded.prompt, choices=excluded.choices,answer_index=excluded.answer_index;

create table if not exists private.buklod_kingdom_mastery_attempts_v1(
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 game_id text not null references private.buklod_kingdom_mastery_catalog_v1(game_id),
 question_set jsonb not null,
 status text not null default 'pending' check(status in ('pending','failed','credited','expired')),
 created_at timestamptz not null default now(),
 expires_at timestamptz not null default (now()+interval '12 minutes'),
 completed_at timestamptz
);
create index if not exists buklod_kingdom_mastery_attempts_by_user_game
 on private.buklod_kingdom_mastery_attempts_v1(user_id,game_id,created_at desc);
revoke all on private.buklod_kingdom_mastery_attempts_v1 from public,anon,authenticated;
alter table private.buklod_kingdom_mastery_attempts_v1 enable row level security;

create or replace function public.start_my_buklod_kingdom_mastery_v1(p_game_id text)
returns jsonb language plpgsql security definer set search_path=''
as $mastery$
declare
 v_uid uuid:=(select auth.uid());
 v_game text:=lower(trim(coalesce(p_game_id,'')));
 v_attempt private.buklod_kingdom_mastery_attempts_v1%rowtype;
 v_questions jsonb;
 v_count integer;
 v_claimed boolean;
 v_q record;
 v_rotation integer;
begin
 if v_uid is null then raise exception 'Authentication required' using errcode='28000'; end if;
 if not exists(select 1 from private.buklod_kingdom_mastery_catalog_v1 c
   where c.game_id=v_game and c.active) then raise exception 'Unknown Kingdom game'; end if;
 perform pg_advisory_xact_lock(hashtextextended(v_uid::text||':kingdom:'||v_game,0));
 select exists(select 1 from public.buklod_points_ledger l where l.user_id=v_uid
   and l.direction='credit' and l.activity_type='game_first_qualified'
   and l.source_key='kingdom:mastery:v1:'||v_game) into v_claimed;
 if v_claimed then return jsonb_build_object('already_earned',true,'points_awarded',0); end if;
 select * into v_attempt from private.buklod_kingdom_mastery_attempts_v1 a
   where a.user_id=v_uid and a.game_id=v_game and a.status='pending'
   and a.expires_at>now() order by created_at desc limit 1 for update;
 if not found then
  select count(*) into v_count from private.buklod_kingdom_mastery_attempts_v1 a
   where a.user_id=v_uid and a.game_id=v_game
   and a.created_at >= (date_trunc('day',now() at time zone 'Asia/Manila') at time zone 'Asia/Manila');
  if v_count>=3 then raise exception 'Daily mastery attempt limit reached'; end if;
  -- The private bank is seeded with conventional answer indices, but
  -- server-side random rotation gives every attempt unpredictable positions.
  -- Neither the correct index nor the private question set is exposed by RPC.
  v_questions := '[]'::jsonb;
  for v_q in
    select b.* from private.buklod_kingdom_mastery_bank_v1 b
    where b.game_id=v_game order by random() limit 3
  loop
    v_rotation := floor(random()*4)::integer;
    v_questions := v_questions || jsonb_build_array(jsonb_build_object(
      'id',v_q.question_no,'prompt',v_q.prompt,
      'choices',jsonb_build_array(
        v_q.choices->((v_rotation+0)%4),
        v_q.choices->((v_rotation+1)%4),
        v_q.choices->((v_rotation+2)%4),
        v_q.choices->((v_rotation+3)%4)),
      'answer',(v_q.answer_index-v_rotation+4)%4));
  end loop;
  if jsonb_array_length(coalesce(v_questions,'[]'::jsonb))<>3 then
    raise exception 'Kingdom mastery bank unavailable';
  end if;
  insert into private.buklod_kingdom_mastery_attempts_v1(user_id,game_id,question_set)
   values(v_uid,v_game,v_questions) returning * into v_attempt;
 end if;
 return jsonb_build_object(
  'challenge_id',v_attempt.id,'game_id',v_game,'expires_at',v_attempt.expires_at,
  'reward_points',2,'already_earned',false,
  'questions',(select jsonb_agg(jsonb_build_object(
   'id',item->>'id','prompt',item->>'prompt','choices',item->'choices'))
    from jsonb_array_elements(v_attempt.question_set) item)
 );
end;
$mastery$;
revoke all on function public.start_my_buklod_kingdom_mastery_v1(text) from public,anon;
grant execute on function public.start_my_buklod_kingdom_mastery_v1(text) to authenticated;

create or replace function public.finish_my_buklod_kingdom_mastery_v1(
 p_challenge_id uuid,p_answers jsonb)
returns jsonb language plpgsql security definer set search_path=''
as $mastery$
declare
 v_uid uuid:=(select auth.uid());
 v_attempt private.buklod_kingdom_mastery_attempts_v1%rowtype;
 v_correct integer:=0;
 v_awarded boolean:=false;
 v_points integer:=0;
 v_ledger uuid;
begin
 if v_uid is null then raise exception 'Authentication required' using errcode='28000'; end if;
 if jsonb_typeof(p_answers) is distinct from 'array' or jsonb_array_length(p_answers)<>3
  then raise exception 'Exactly 3 answers are required'; end if;
 select * into v_attempt from private.buklod_kingdom_mastery_attempts_v1 a
  where a.id=p_challenge_id and a.user_id=v_uid for update;
 if not found then raise exception 'Challenge not found';end if;
 perform pg_advisory_xact_lock(hashtextextended(v_uid::text||':kingdom:'||v_attempt.game_id,0));
 if v_attempt.status<>'pending' then
   return jsonb_build_object('verified',v_attempt.status='credited',
     'already_processed',true,'points_awarded',0);
 end if;
 if now()>v_attempt.expires_at then
  update private.buklod_kingdom_mastery_attempts_v1 set status='expired',completed_at=now()
   where id=v_attempt.id;
  return jsonb_build_object('verified',false,'expired',true,'points_awarded',0);
 end if;
 select count(*)::integer into v_correct
 from jsonb_array_elements(v_attempt.question_set) with ordinality as t(item,ord)
 where (p_answers->>(t.ord::integer-1)) ~ '^[0-3]$'
  and (p_answers->>(t.ord::integer-1))::integer=(t.item->>'answer')::integer;
 if v_correct<>3 then
  update private.buklod_kingdom_mastery_attempts_v1
   set status='failed',completed_at=now() where id=v_attempt.id;
  return jsonb_build_object('verified',false,'correct',v_correct,
     'points_awarded',0,'retry_allowed',true);
 end if;
 -- The DB, not the client, controls award amount, eligibility, and source key.
 select least(2,r.base_points,coalesce(r.max_points_per_event,2))::integer into v_points
 from public.buklod_point_rules r
 where r.activity_type='game_first_qualified' and r.is_active=true;
 if coalesce(v_points,0)<>2 then raise exception 'Kingdom mastery reward policy unavailable';end if;
 insert into public.buklod_points_ledger(
  user_id,direction,points,activity_type,source_key,source_id,description,awarded_by)
 values(v_uid,'credit',2,'game_first_qualified',
 'kingdom:mastery:v1:'||v_attempt.game_id,null,
 'Kingdom server-verified Mastery Check: '||v_attempt.game_id,v_uid)
 on conflict(user_id,source_key) do nothing returning id into v_ledger;
 v_awarded:=v_ledger is not null;
 update private.buklod_kingdom_mastery_attempts_v1
  set status='credited',completed_at=now() where id=v_attempt.id;
 return jsonb_build_object('verified',true,'first_mastery',v_awarded,
  'points_awarded',case when v_awarded then 2 else 0 end,
  'claim_required',v_awarded);
end;
$mastery$;
revoke all on function public.finish_my_buklod_kingdom_mastery_v1(uuid,jsonb) from public,anon;
grant execute on function public.finish_my_buklod_kingdom_mastery_v1(uuid,jsonb) to authenticated;

create or replace function public.get_my_buklod_kingdom_mastery_progress_v1()
returns jsonb language sql stable security definer set search_path=''
as $mastery$
select jsonb_build_object('mastered_games',count(*),'game_ids',
 coalesce(jsonb_agg(replace(source_key,'kingdom:mastery:v1:','') order by created_at),'[]'::jsonb))
from public.buklod_points_ledger
where user_id=(select auth.uid()) and direction='credit'
 and activity_type='game_first_qualified' and source_key like 'kingdom:mastery:v1:%';
$mastery$;
revoke all on function public.get_my_buklod_kingdom_mastery_progress_v1() from public,anon;
grant execute on function public.get_my_buklod_kingdom_mastery_progress_v1() to authenticated;

-- ONLY server-scored mastery challenges activate this 2 BP reward family.
-- Other game difficulty, perfect and tournament rewards remain disabled
-- until independently verified by their respective skill engines.
update public.buklod_point_rules set base_points=2,max_points_per_event=2,
 is_active=true,notes='First completed server-verified 3-of-3 Kingdom Mastery Check per game; not an attestation of local gameplay score',
 updated_at=now() where activity_type='game_first_qualified';
