module.exports = {
    env: {
        es2020: true,
        node: true,
    },
    extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended', 'plugin:prettier/recommended'],
    parser: '@typescript-eslint/parser',
    parserOptions: {
        project: './tsconfig.json',
        ecmaVersion: 12,
        sourceType: 'module',
    },
    plugins: ['@typescript-eslint', 'prettier'],
    rules: {
        'prettier/prettier': 'error',
        '@typescript-eslint/no-unused-vars': 'error',
        // '@typescript-eslint/no-explicit-any': 'error',
        "@typescript-eslint/no-floating-promises": ['error'],
        "@typescript-eslint/no-misused-promises": ['warn'],
        "@typescript-eslint/explicit-function-return-type": 'error'
    },
};
