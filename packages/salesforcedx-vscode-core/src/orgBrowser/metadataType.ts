/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { isNullOrUndefined } from '@salesforce/salesforcedx-utils-vscode/out/src/helpers';
import * as fs from 'fs';
import * as path from 'path';
import { forceDescribeMetadata } from '../commands';
import { nls } from '../messages';
import { telemetryService } from '../telemetry';
import { getRootWorkspacePath, hasRootWorkspace, OrgAuthInfo } from '../util';

type MetadataObject = {
  directoryName: string;
  inFolder: boolean;
  metaFile: boolean;
  suffix: string;
  xmlName: string;
};
export class TypeUtils {
  public static readonly FOLDER_TYPES = new Set([
    'EmailTemplate',
    'Report',
    'Dashboard',
    'Document'
  ]);

  public static readonly UNSUPPORTED_TYPES = new Set([
    'InstalledPackage',
    'Profile',
    'ProfilePasswordPolicy',
    'ProfileSessionSetting',
    'Scontrol'
  ]);

  public async getTypesFolder(usernameOrAlias: string): Promise<string> {
    if (!hasRootWorkspace()) {
      const err = nls.localize('cannot_determine_workspace');
      telemetryService.sendError(err);
      throw new Error(err);
    }
    const workspaceRootPath = getRootWorkspacePath();
    const username =
      (await OrgAuthInfo.getUsername(usernameOrAlias)) || usernameOrAlias;
    const metadataTypesPath = path.join(
      workspaceRootPath,
      '.sfdx',
      'orgs',
      username,
      'metadata'
    );
    return metadataTypesPath;
  }

  public buildTypesList(
    metadataFile?: any,
    metadataTypesPath?: string
  ): string[] {
    try {
      if (isNullOrUndefined(metadataFile)) {
        metadataFile = fs.readFileSync(metadataTypesPath!, 'utf8');
      }
      const jsonObject = JSON.parse(metadataFile);
      const metadataObjects = jsonObject.result
        .metadataObjects as MetadataObject[];
      const metadataTypes = [];
      for (const type of metadataObjects) {
        if (
          !isNullOrUndefined(type.xmlName) &&
          !TypeUtils.UNSUPPORTED_TYPES.has(type.xmlName)
        ) {
          metadataTypes.push(type.xmlName);
        }
      }
      telemetryService.sendEventData('Metadata Types Quantity', undefined, {
        metadataTypes: metadataTypes.length
      });
      return metadataTypes.sort();
    } catch (e) {
      telemetryService.sendError(e);
      throw new Error(e);
    }
  }

  public async loadTypes(
    defaultOrg: string,
    forceRefresh?: boolean
  ): Promise<string[]> {
    const typesFolder = await this.getTypesFolder(defaultOrg);
    const typesPath = path.join(typesFolder, 'metadataTypes.json');

    let typesList: string[];
    if (forceRefresh || !fs.existsSync(typesPath)) {
      const result = await forceDescribeMetadata(typesFolder);
      typesList = this.buildTypesList(result, undefined);
    } else {
      typesList = this.buildTypesList(undefined, typesPath);
    }
    return typesList;
  }

  public getFolderForType(metadataType: string): string {
    return `${metadataType === 'EmailTemplate' ? 'Email' : metadataType}Folder`;
  }
}
