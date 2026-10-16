module.exports = function inlineMobileEnvironment({ types: t }, options = {}) {
    return {
        name: 'inline-mobile-environment',
        visitor: {
            MemberExpression(path) {
                const { node } = path;
                if (path.parentPath.isAssignmentExpression() && path.key === 'left') return;
                if (path.parentPath.isUnaryExpression({ operator: 'delete' })) return;
                if (
                    node.computed ||
                    !t.isIdentifier(node.property) ||
                    !t.isMemberExpression(node.object) ||
                    !t.isIdentifier(node.object.object, { name: 'process' }) ||
                    !t.isIdentifier(node.object.property, { name: 'env' })
                ) {
                    return;
                }

                const key = node.property.name;
                if (!options.keys?.includes(key)) return;

                path.replaceWith(t.stringLiteral(options.values?.[key] ?? process.env[key] ?? ''));
            },
        },
    };
};
