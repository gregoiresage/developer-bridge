import * as path from 'path';

import dateformat from 'dateformat';
import untildify from 'untildify';
import vorpal from '@moleculer/vorpal';
import open from 'open';
import { PNG } from 'pngjs';
import { mergeMaskByFile, outputAsync } from 'alpha-mask';

import HostConnections from '../models/HostConnections';
import captureScreenshot from '../models/captureScreenshot';

export default function screenshot(stores: {
  hostConnections: HostConnections;
}) {
  return (cli: vorpal) => {
    cli
      .command(
        'screenshot [path] [--open]',
        'Capture a screenshot from the connected device',
      )
      .types({ string: ['path', 'mask'] })
      .option(
        '-o, --open',
        'Opens the screenshot using the native picture viewer',
      )
      .option(
        '--mask <mask>',
        'Masks the screenshot using the given image (B&W)',
      )
      .action(
        async (
          args: vorpal.Args & { path?: string; open?: boolean; mask?: string },
        ) => {
          const { appHost } = stores.hostConnections;
          if (!appHost) {
            cli.activeCommand.log('Not connected to a device');
            return false;
          }

          const destPath = path.resolve(
            args.path
              ? untildify(args.path)
              : dateformat('"Screenshot" yyyy-mm-dd "at" H.MM.ss."png"'),
          );

          try {
            await captureScreenshot(appHost.host, destPath, {
              onWrite(received, total) {
                cli.ui.redraw(
                  total == null
                    ? 'Downloading...'
                    : `Downloading: ${Math.round(
                        (received / total) * 100,
                      )}% completed`,
                );
              },
            });

            if (args.options.mask) {
              const maskPath = path.resolve(untildify(args.options.mask));
              await mergeMaskByFile(destPath, maskPath).then((res: PNG) =>
                outputAsync(destPath, res),
              );
            }

            cli.ui.redraw(`Screenshot saved to ${destPath}`);

            if (args.options.open) {
              await open(destPath, { wait: false });
            }
            return true;
          } catch (ex) {
            cli.ui.redraw(String(ex));
            return false;
          } finally {
            cli.ui.redraw.done();
          }
        },
      );
  };
}
