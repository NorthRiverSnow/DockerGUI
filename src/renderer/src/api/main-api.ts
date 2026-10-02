import type { WindowApi } from "../../../shared/channels";
import { appApiOf, type AppApi } from "./app-api";
import { connectionApiOf, type ConnectionApi } from "./connection-api";
import { containersApiOf, type ContainersApi } from "./containers-api";

/** main の窓口（docs/design/renderer.md の「main の窓口」）。口のまとまりごとの窓口をまとめる。 */
export type MainApi = {
  connection: ConnectionApi;
  app: AppApi;
  containers: ContainersApi;
};

export function realMainApiOf(windowApi: WindowApi): MainApi {
  return {
    connection: connectionApiOf(windowApi),
    app: appApiOf(windowApi),
    containers: containersApiOf(windowApi),
  };
}
