import stripIndent from 'strip-indent';
import postcss from 'postcss'
import plugin from '../src'

const strip = input => stripIndent(input).replace(/^\n/, '')
const generateScopedName = local => `__scope__${local}`;
const compile = (input, options) => postcss([plugin(options)]).process(input)
const run = ({ fixture, expected = null, warnings = [] }) => {
  return compile(strip(fixture), { generateScopedName }).then(result => {
    if (expected) {
      expect(strip(result.css)).toEqual(strip(expected));
    }
    expect(result.warnings().map(warning => warning.text)).toEqual(warnings);
  })
};

test('export local-scope keyframes', () => {
  return run({
    fixture: `
      @keyframes fade-in {}
    `,
    expected: `
      :export {
        fade-in: __scope__fade-in
      }
      @keyframes __scope__fade-in {}
    `
  })
})

test('replace defined animation name', () => {
  return run({
    fixture: `
      @keyframes foo {}
      .bar {
        animation: foo, foo;
        animation-name: foo, foo;
      }
    `,
    expected: `
      :export {
        foo: __scope__foo;
      }
      @keyframes __scope__foo {}
      .bar {
        animation: __scope__foo, __scope__foo;
        animation-name: __scope__foo, __scope__foo;
      }
    `
  })
})

test('warn on using reserved animation name', () => {
  const names = [
    'none',
    'inherited',
    'initial',
    'unset',
    /* single-timing-function */
    'linear',
    'ease',
    'ease-in',
    'ease-in-out',
    'ease-out',
    'step-start',
    'step-end',
    'start',
    'end',
    /* single-animation-iteration-count */
    'infinite',
    /* single-animation-direction */
    'normal',
    'reverse',
    'alternate',
    'alternate-reverse',
    /* single-animation-fill-mode */
    'forwards',
    'backwards',
    'both',
    /* single-animation-play-state */
    'running',
    'paused',
  ];
  const input = names.map(name => `@keyframes ${name} {}`).join('\n')
  return run({
    fixture: input,
    expected: input,
    warnings: names.map(name => `Unable to use reserve '${name}' animation name`)
  });
})

test('warn on using invalid animation name identifier', () => {
  return run({
    fixture: `
      @keyframes 22 {}
      @keyframes 22s {}
      @keyframes anim22 {}
    `,
    expected: `
      :export {
        anim22: __scope__anim22
      }
      @keyframes 22 {}
      @keyframes 22s {}
      @keyframes __scope__anim22 {}
    `,
    warnings: [
      `Invalid animation name identifier '22'`,
      `Invalid animation name identifier '22s'`
    ]
  });
})

test('skips not defined animation name', () => {
  return run({
    fixture: `
      .bar {
        animation: foo, foo;
        animation-name: foo, foo;
      }
    `,
    expected: `
      .bar {
        animation: foo, foo;
        animation-name: foo, foo;
      }
    `
  })
})

test('replace local-scope name in prefixed keyframes', () => {
  return run({
    fixture: `
      @-webkit-keyframes foo {}
      @-moz-keyframes foo {}
      .bar {
        -webkit-animation: foo, foo;
        -webkit-animation-name: foo, foo;
        -moz-animation: foo, foo;
        -moz-animation-name: foo, foo;
      }
    `,
    expected: `
      :export {
        foo: __scope__foo;
      }
      @-webkit-keyframes __scope__foo {}
      @-moz-keyframes __scope__foo {}
      .bar {
        -webkit-animation: __scope__foo, __scope__foo;
        -webkit-animation-name: __scope__foo, __scope__foo;
        -moz-animation: __scope__foo, __scope__foo;
        -moz-animation-name: __scope__foo, __scope__foo;
      }
    `
  });
});

test('do not replace local-scope name in non-animation props', () => {
  return run({
    fixture: `
      @keyframes foo {}
      .bar { content: foo }
    `,
    expected: `
      :export {
        foo: __scope__foo
      }
      @keyframes __scope__foo {}
      .bar { content: foo }
    `
  });
});

test('warn on using exising name in :export and override it', () => {
  return run({
    fixture: `
      :export {
        foo: __scope__selector
      }
      @keyframes foo {}
    `,
    expected: `
      :export {
        foo: __scope__foo
      }
      @keyframes __scope__foo {}
    `,
    warnings: [
      `'foo' identifier is already declared and will be override`
    ]
  });
});

test('extend existing :export and save :import', () => {
  return run({
    fixture: `
      :import('path/to/file.css') {
        __scope__selector: alias
      }
      :export {
        foo: __scope__selector
      }
      @keyframes name {}
    `,
    expected: `
      :import('path/to/file.css') {
        __scope__selector: alias
      }
      :export {
        foo: __scope__selector;
        name: __scope__name
      }
      @keyframes __scope__name {}
    `
  })
})

test('default scope name generator saves local identifier', () => {
  return expect(compile('@keyframes foo {}').then(result => result.css)).resolves.toEqual(
    ':export {\n  foo: foo\n}\n@keyframes foo {}'
  )
})
