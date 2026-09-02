export class BibleAmbienceController {
  setEnabled(_enabled: boolean) {}
  setUserVolume(_volume: number) {}
  async transitionTo(_kind: string) {}
  async playOneShot(_kind: string) {}
  pause() {}
  resume() {}
  async stop() {}
  release() {}
}

export const bibleAmbienceController =
  new BibleAmbienceController();
