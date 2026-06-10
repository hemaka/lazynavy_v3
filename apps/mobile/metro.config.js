const { getDefaultConfig } = require('expo/metro-config')
const path = require('path')

const projectRoot = __dirname
const workspaceRoot = path.resolve(projectRoot, '../..')

const config = getDefaultConfig(projectRoot)

config.watchFolders = [workspaceRoot]
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
]
config.resolver.unstable_enableSymlinks = true

const defaultResolveRequest = config.resolver.resolveRequest
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === 'web' && moduleName === 'react-native-maps') {
    return {
      filePath: path.resolve(projectRoot, 'src/shims/react-native-maps.web.tsx'),
      type: 'sourceFile',
    }
  }

  if (platform === 'web' && moduleName === 'expo-sqlite') {
    return {
      filePath: path.resolve(projectRoot, 'src/shims/expo-sqlite.web.ts'),
      type: 'sourceFile',
    }
  }

  return defaultResolveRequest
    ? defaultResolveRequest(context, moduleName, platform)
    : context.resolveRequest(context, moduleName, platform)
}

module.exports = config
