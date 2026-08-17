/**
 * PATCH 153H-3B
 * BIBLE SEARCH
 *
 * Search ASD / KJV by word or phrase.
 * Tap result -> exact chapter + highlighted verse.
 */

import {
  useCallback,
  useEffect,
  useState,
} from 'react';

import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { router } from 'expo-router';

import { supabase } from '@/lib/supabase';

import {
  Card,
  SectionTitle,
  shared,
} from '@/components/UI';


type Translation = {
  code: string;
  short_title: string;
  title: string;
  language_name: string;
  license_name: string;
};


type SearchResult = {
  translation_code: string;

  book_no: number;
  book_name: string;

  chapter_no: number;
  verse_no: number;

  bible_reference: string;
  verse_text: string;
};


export default function BibleSearchScreen() {
  const [translations, setTranslations] =
    useState<Translation[]>([]);

  const [translation, setTranslation] =
    useState('ASD');

  const [query, setQuery] =
    useState('');

  const [results, setResults] =
    useState<SearchResult[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [searching, setSearching] =
    useState(false);

  const [hasSearched, setHasSearched] =
    useState(false);


  const initialize = useCallback(async () => {
    setLoading(true);

    try {
      const [
        translationResult,
        preferredResult,
      ] = await Promise.all([
        (supabase as any).rpc(
          'get_available_bible_translations'
        ),

        (supabase as any).rpc(
          'get_my_preferred_bible_version'
        ),
      ]);


      if (translationResult.error) {
        throw translationResult.error;
      }


      const available =
        (
          translationResult.data ??
          []
        ) as Translation[];


      setTranslations(available);


      const preferred =
        String(
          preferredResult.data ??
          'ASD'
        ).toUpperCase();


      if (
        available.some(
          item =>
            item.code === preferred
        )
      ) {
        setTranslation(preferred);

      } else if (available.length) {
        setTranslation(
          available[0].code
        );
      }

    } catch (e: any) {
      Alert.alert(
        'Bible Search',
        e?.message ??
          'Unable to initialize Bible Search.'
      );

    } finally {
      setLoading(false);
    }
  }, []);


  useEffect(() => {
    initialize();
  }, [initialize]);


  const changeTranslation =
    async (
      code: string
    ) => {

      setTranslation(code);

      setResults([]);
      setHasSearched(false);


      const { error } =
        await (supabase as any).rpc(
          'set_my_preferred_bible_version',
          {
            p_translation_code:
              code,
          }
        );


      if (error) {
        console.warn(
          'Unable to save preferred Bible version:',
          error.message
        );
      }
    };


  const search = async () => {
    const clean =
      query.trim();

    if (clean.length < 2) {
      Alert.alert(
        'Bible Search',
        'Enter at least 2 characters.'
      );

      return;
    }


    setSearching(true);
    setHasSearched(true);


    try {
      const {
        data,
        error,
      } =
        await (supabase as any).rpc(
          'search_bible_text',
          {
            p_query:
              clean,

            p_translation_code:
              translation,

            p_limit:
              50,
          }
        );


      if (error) throw error;


      setResults(
        (
          data ??
          []
        ) as SearchResult[]
      );

    } catch (e: any) {
      setResults([]);

      Alert.alert(
        'Bible Search',
        e?.message ??
          'Unable to search the Bible.'
      );

    } finally {
      setSearching(false);
    }
  };


  const openResult =
    (
      result: SearchResult
    ) => {

      router.push({
        pathname:
          '/bible/read',

        params: {
          translation:
            result.translation_code,

          book:
            String(
              result.book_no
            ),

          chapter:
            String(
              result.chapter_no
            ),

          verse:
            String(
              result.verse_no
            ),

          source:
            'search',
        },
      });
    };


  if (loading) {
    return (
      <View
        style={[
          shared.screen,
          styles.center,
        ]}
      >
        <ActivityIndicator
          size="large"
        />

        <Text
          style={[
            shared.muted,
            {
              marginTop: 10,
            },
          ]}
        >
          Loading Bible Search...
        </Text>
      </View>
    );
  }


  return (
    <ScrollView
      style={shared.screen}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={[
        shared.content,
        styles.content,
      ]}
    >
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={shared.h1}>
            Search Bible
          </Text>

          <Text style={shared.muted}>
            Find words, phrases, and Bible references.
          </Text>
        </View>

        <Pressable
          onPress={() =>
            router.back()
          }
          style={styles.outline}
        >
          <Text
            style={
              styles.outlineText
            }
          >
            BACK
          </Text>
        </Pressable>
      </View>


      <Card>
        <Text style={styles.eyebrow}>
          BIBLE VERSION
        </Text>

        <View
          style={
            styles.translationRow
          }
        >
          {translations.map(
            item => {

              const active =
                item.code ===
                translation;


              return (
                <Pressable
                  key={
                    item.code
                  }
                  onPress={() =>
                    changeTranslation(
                      item.code
                    )
                  }
                  style={[
                    styles.translation,
                    active &&
                      styles.translationActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.translationCode,
                      active &&
                        styles.white,
                    ]}
                  >
                    {
                      item.code
                    }
                  </Text>

                  <Text
                    numberOfLines={1}
                    style={[
                      styles.translationName,
                      active &&
                        styles.translationNameActive,
                    ]}
                  >
                    {
                      item.short_title
                    }
                  </Text>
                </Pressable>
              );
            }
          )}
        </View>
      </Card>


      <SectionTitle>
        SEARCH
      </SectionTitle>


      <Card>
        <TextInput
          value={query}
          onChangeText={
            setQuery
          }
          placeholder={
            translation === 'ASD'
              ? 'Halimbawa: pag-ibig, pananampalataya, biyaya'
              : 'Example: love, faith, grace'
          }
          placeholderTextColor="#89958E"
          returnKeyType="search"
          onSubmitEditing={
            search
          }
          autoCorrect={false}
          style={styles.input}
        />


        <Pressable
          disabled={
            searching
          }
          onPress={
            search
          }
          style={[
            styles.searchButton,
            searching &&
              {
                opacity: 0.5,
              },
          ]}
        >
          <Text
            style={
              styles.searchButtonText
            }
          >
            {searching
              ? 'SEARCHING...'
              : 'SEARCH BIBLE'}
          </Text>
        </Pressable>


        <Text
          style={
            styles.searchHelp
          }
        >
          Search a word or phrase. Tap any result to open the full chapter and highlight the exact verse.
        </Text>
      </Card>


      <SectionTitle>
        RESULTS
      </SectionTitle>


      {searching ? (
        <Card>
          <View
            style={
              styles.searching
            }
          >
            <ActivityIndicator />

            <Text
              style={[
                shared.muted,
                {
                  marginTop: 8,
                },
              ]}
            >
              Searching Scripture...
            </Text>
          </View>
        </Card>

      ) : hasSearched &&
        !results.length ? (
        <Card>
          <Text style={shared.h2}>
            No verses found
          </Text>

          <Text
            style={[
              shared.muted,
              {
                marginTop: 7,
              },
            ]}
          >
            Try another word, spelling, or Bible version.
          </Text>
        </Card>

      ) : !hasSearched ? (
        <Card>
          <Text style={shared.h2}>
            Search God's Word
          </Text>

          <Text
            style={[
              shared.muted,
              {
                marginTop: 7,
                lineHeight: 18,
              },
            ]}
          >
            Results will appear here with their Bible reference and verse text.
          </Text>
        </Card>

      ) : (
        <>
          <Text
            style={
              styles.resultCount
            }
          >
            {results.length}
            {results.length === 50
              ? '+'
              : ''}{' '}
            result
            {results.length === 1
              ? ''
              : 's'}
          </Text>


          {results.map(
            (
              result,
              index
            ) => {

              const cleanText =
                String(
                  result.verse_text
                )
                  .replace(
                    /^¶\s*/,
                    ''
                  )
                  .trim();


              return (
                <Pressable
                  key={
                    `${result.translation_code}-${result.book_no}-${result.chapter_no}-${result.verse_no}-${index}`
                  }
                  onPress={() =>
                    openResult(
                      result
                    )
                  }
                >
                  <Card>
                    <View
                      style={
                        styles.resultHeader
                      }
                    >
                      <Text
                        style={
                          styles.reference
                        }
                      >
                        {
                          result.bible_reference
                        }
                      </Text>

                      <View
                        style={
                          styles.versionBadge
                        }
                      >
                        <Text
                          style={
                            styles.versionBadgeText
                          }
                        >
                          {
                            result.translation_code
                          }
                        </Text>
                      </View>
                    </View>


                    <Text
                      style={
                        styles.verseText
                      }
                    >
                      {cleanText}
                    </Text>


                    <Text
                      style={
                        styles.openText
                      }
                    >
                      OPEN CHAPTER ›
                    </Text>
                  </Card>
                </Pressable>
              );
            }
          )}
        </>
      )}
    </ScrollView>
  );
}


const styles =
  StyleSheet.create({

    content: {
      paddingBottom: 50,
      gap: 14,
    },


    center: {
      flex: 1,
      alignItems: 'center',
      justifyContent:
        'center',
    },


    header: {
      flexDirection: 'row',
      gap: 12,
      alignItems:
        'flex-start',
    },


    outline: {
      paddingHorizontal: 12,
      paddingVertical: 9,
      borderWidth: 1,
      borderColor:
        '#D7DFDA',
      borderRadius: 12,
    },


    outlineText: {
      fontSize: 11,
      fontWeight: '900',
      color: '#275D45',
    },


    eyebrow: {
      fontSize: 9,
      fontWeight: '900',
      color: '#718078',
      letterSpacing: 0.7,
    },


    translationRow: {
      marginTop: 10,
      flexDirection: 'row',
      gap: 8,
    },


    translation: {
      flex: 1,
      minHeight: 57,
      borderWidth: 1,
      borderColor:
        '#DCE3DF',
      borderRadius: 14,
      paddingHorizontal: 12,
      paddingVertical: 9,
      justifyContent:
        'center',
      backgroundColor:
        '#FAFBFA',
    },


    translationActive: {
      backgroundColor:
        '#275D45',
      borderColor:
        '#275D45',
    },


    translationCode: {
      fontSize: 15,
      fontWeight: '900',
      color: '#283C32',
    },


    translationName: {
      marginTop: 2,
      fontSize: 9,
      color: '#738078',
    },


    translationNameActive: {
      color: '#DDEAE3',
    },


    white: {
      color: '#FFF',
    },


    input: {
      minHeight: 52,
      borderWidth: 1,
      borderColor:
        '#D7E0DA',
      borderRadius: 14,
      paddingHorizontal: 14,
      fontSize: 15,
      color: '#23372D',
      backgroundColor:
        '#FBFCFB',
    },


    searchButton: {
      marginTop: 10,
      minHeight: 49,
      alignItems: 'center',
      justifyContent:
        'center',
      borderRadius: 14,
      backgroundColor:
        '#275D45',
    },


    searchButtonText: {
      fontSize: 11,
      fontWeight: '900',
      color: '#FFF',
    },


    searchHelp: {
      marginTop: 9,
      fontSize: 10,
      lineHeight: 16,
      color: '#78857E',
    },


    searching: {
      minHeight: 110,
      alignItems: 'center',
      justifyContent:
        'center',
    },


    resultCount: {
      fontSize: 10,
      fontWeight: '800',
      color: '#77857D',
    },


    resultHeader: {
      flexDirection: 'row',
      gap: 10,
      alignItems: 'center',
    },


    reference: {
      flex: 1,
      fontSize: 17,
      fontWeight: '900',
      color: '#244333',
    },


    versionBadge: {
      paddingHorizontal: 8,
      paddingVertical: 5,
      borderRadius: 9,
      backgroundColor:
        '#EAF3EE',
    },


    versionBadgeText: {
      fontSize: 8,
      fontWeight: '900',
      color: '#275D45',
    },


    verseText: {
      marginTop: 9,
      fontSize: 14.5,
      lineHeight: 22,
      color: '#35473E',
    },


    openText: {
      marginTop: 10,
      fontSize: 9,
      fontWeight: '900',
      color: '#275D45',
    },
  });