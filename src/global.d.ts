export {};

declare global {
  interface Window {
    desktopApp: {
      dbQuery: (sql: string, params?: any[]) => Promise<any>;
      dbRun: (sql: string, params?: any[]) => Promise<any>;
      dbExec: (sql: string) => Promise<any>;
      loadDatabase: () => Promise<any>;
      saveDatabase: (data: number[]) => Promise<any>;
    };
  }
}
