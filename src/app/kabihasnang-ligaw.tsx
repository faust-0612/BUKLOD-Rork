import React from 'react';

import KlReaderScreen from '@/components/kabihasnang-ligaw/KlReaderScreen';
import KlEditorRenderBoundary from '@/components/kabihasnang-ligaw/KlEditorRenderBoundary';

export default function KabihasnangLigawScreen() {
  return <KlEditorRenderBoundary scope="reader"><KlReaderScreen /></KlEditorRenderBoundary>;
}
