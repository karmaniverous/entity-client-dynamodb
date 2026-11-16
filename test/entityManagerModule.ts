const entityManagerModuleUrl = import.meta
  .resolve('@karmaniverous/entity-manager');
const entityToolsModuleUrl = import.meta.resolve('@karmaniverous/entity-tools');

export function commonJsDefault(body: string): string {
  return `module.exports = ${body};\nmodule.exports.default = module.exports;`;
}

export function entityManagerFactory(
  configSource: string,
  includeDefaultTranscodes = false,
): string {
  return `async () => {
  const { EntityManager } = await import(${JSON.stringify(entityManagerModuleUrl)});
  ${
    includeDefaultTranscodes
      ? `const { defaultTranscodes } = await import(${JSON.stringify(entityToolsModuleUrl)});`
      : ''
  }
  return new EntityManager(${configSource});
}`;
}
