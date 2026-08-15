import * as nativePath from 'node:path'

export function isStrictlyContained(parent, child, pathApi = nativePath) {
  const relation = pathApi.relative(parent, child)
  return relation !== ''
    && relation !== '..'
    && !relation.startsWith(`..${pathApi.sep}`)
    && !pathApi.isAbsolute(relation)
}
