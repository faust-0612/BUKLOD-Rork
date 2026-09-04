from pathlib import Path

home_path = Path('src/app/(tabs)/home.tsx')
detail_path = Path('src/app/devotional/[id].tsx')

home = home_path.read_text(encoding='utf-8')

if 'get_my_daily_devotional' not in home:
    if 'get_my_weekly_devotional' not in home:
        raise SystemExit('Expected weekly devotional RPC marker not found')
    home = home.replace('get_my_weekly_devotional', 'get_my_daily_devotional')

home = home.replace("'Weekly Devotional'", "'Daily Devotional'")
home = home.replace('WEEKLY DEVOTIONAL', "TODAY'S DEVOTIONAL")
home = home.replace('OPEN WEEKLY DEVOTIONAL', "OPEN TODAY'S DEVOTIONAL")
home = home.replace('weekly devotional query remains', 'daily devotional query remains')
home = home.replace('weekly devotional, keep null.', 'daily devotional, keep null.')

if 'get_my_daily_devotional' not in home:
    raise SystemExit('Daily devotional RPC not installed in Home')
if 'OPEN WEEKLY DEVOTIONAL' in home:
    raise SystemExit('Old weekly devotional button still present')

home_path.write_text(home, encoding='utf-8')

detail = detail_path.read_text(encoding='utf-8')

if 'BUKLOD_DAILY_DEVOTIONAL_R24_DETAIL' not in detail:
    old = '''      <Text style={shared.muted}>{item.bible_passage}</Text>
      <Text style={shared.h1}>{item.title}</Text>
      <S title="📖 SCRIPTURE">{item.scripture_text || item.key_verse}</S>
      <S title="✍️ REFLECTION">{item.reflection_text}</S>
      <S title="❓ THINK ABOUT IT">{item.think_about_it}</S>
      <S title="✅ LIVE IT TODAY">{item.live_it_today}</S>
      <S title="🙏 PRAY">{item.prayer_text}</S>
      <Button title="CONTINUE TO REFLECTION" onPress={()=>router.push(`/reflection/${item.id}`)} />'''

    new = '''      {/* BUKLOD_DAILY_DEVOTIONAL_R24_DETAIL */}
      <Text style={[shared.muted,{fontWeight:'800'}]}>{item.bible_passage}</Text>
      <Text style={[shared.h1,{marginTop:4}]}>{item.title}</Text>
      <S title="📖 SCRIPTURE">{item.scripture_text || item.key_verse}</S>
      <S title="✍️ REFLECTION">{item.reflection_text}</S>
      <S title="🌱 STORY / ILLUSTRATION">{item.illustration_text}</S>
      {item.quotation_text ? (
        <Card>
          <Text style={shared.h2}>💬 QUOTATION</Text>
          <Text style={[shared.body,{marginTop:7,fontStyle:'italic'}]}>
            “{item.quotation_text}”
          </Text>
          {item.quotation_author ? (
            <Text style={[shared.muted,{marginTop:7,fontWeight:'800'}]}>
              — {item.quotation_author}
            </Text>
          ) : null}
        </Card>
      ) : null}
      <S title="❓ THINK ABOUT IT">{item.think_about_it}</S>
      <S title="🛠️ PRACTICAL TODAY">{item.live_it_today || item.application_text}</S>
      <S title="🙏 PRAY">{item.prayer_text}</S>
      <Button title="CONTINUE TO REFLECTION" onPress={()=>router.push(`/reflection/${item.id}`)} />'''

    if old not in detail:
        raise SystemExit('Expected devotional detail block not found')
    detail = detail.replace(old, new, 1)

if 'BUKLOD_DAILY_DEVOTIONAL_R24_DETAIL' not in detail:
    raise SystemExit('R24 detail marker not installed')

detail_path.write_text(detail, encoding='utf-8')

print('DAILY_DEVOTIONAL_R24_PATCHED=1')
