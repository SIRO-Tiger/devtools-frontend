// Copyright 2020 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.
import {assert} from 'chai';

import {generateClosureBridge, generateClosureClass, generateCreatorFunction, generateInterfaces} from '../../../../scripts/component_bridges/generate_closure.js';
import {WalkerState, walkTree} from '../../../../scripts/component_bridges/walk_tree.js';

import {createTypeScriptSourceFile} from './test_utils.js';


const parseCode = (code: string): WalkerState => {
  const sourceFile = createTypeScriptSourceFile(code);
  const result = walkTree(sourceFile, 'test.ts');
  return result;
};

describe('generateClosure', () => {
  describe('generateClosureBridge', () => {
    it('generates a full bridge with the different parts', () => {
      const state = parseCode(`interface Person {
        name: string
        age: number
      }
      class Breadcrumbs extends HTMLElement {
        public update(person: Person) {}
      }

      customElements.define('devtools-breadcrumbs', Breadcrumbs)
      `);

      const generatedCode = generateClosureBridge(state);

      assert.include(generatedCode.interfaces.join(''), 'Person');
      assert.include(generatedCode.closureClass.join(''), 'class BreadcrumbsClosureInterface');
      assert.include(generatedCode.creatorFunction.join(''), 'function createBreadcrumbs()');
    });
  });

  describe('generateCreatorFunction', () => {
    it('outputs the JSDoc with the right interface name', () => {
      const state = parseCode(`interface Person {
        name: string
        age: number
      }
      class Breadcrumbs extends HTMLElement {
        public update(person: Person) {}
      }

      customElements.define('devtools-breadcrumbs', Breadcrumbs)
      `);

      const classOutput = generateCreatorFunction(state);

      assert.include(classOutput.join('\n'), `/**
* @return {!BreadcrumbsClosureInterface}
*/`);
    });

    it('creates the function export', () => {
      const state = parseCode(`interface Person {
        name: string
        age: number
      }
      class Breadcrumbs extends HTMLElement {
        public update(person: Person) {}
      }

      customElements.define('devtools-breadcrumbs', Breadcrumbs)
      `);

      const classOutput = generateCreatorFunction(state);

      assert.include(classOutput.join('\n'), 'export function createBreadcrumbs() {');
    });

    it('correctly generates the return type', () => {
      const state = parseCode(`interface Person {
        name: string
        age: number
      }
      class Breadcrumbs extends HTMLElement {
        public update(person: Person) {}
      }

      customElements.define('devtools-breadcrumbs', Breadcrumbs)
      `);

      const classOutput = generateCreatorFunction(state);

      assert.include(
          classOutput.join('\n'),
          'return /** @type {!BreadcrumbsClosureInterface} */ (document.createElement(\'devtools-breadcrumbs\'))');
    });
  });

  describe('generateClosureClass', () => {
    it('outputs the class with a Closure specific name', () => {
      const state = parseCode(`interface Person {
        name: string
        age: number
      }
      class Breadcrumbs extends HTMLElement {
        private render() {}

        public update(person: Person) {}
      }`);

      const classOutput = generateClosureClass(state);

      assert.isTrue(classOutput.includes('class BreadcrumbsClosureInterface extends HTMLElement {'));
    });

    it('generates the correct JSDoc for the public methods', () => {
      const state = parseCode(`interface Person {
        name: string
        age: number
      }
      class Breadcrumbs extends HTMLElement {
        private render() {}

        public update(person: Person) {}
      }`);

      const classOutput = generateClosureClass(state);

      assert.include(classOutput.join('\n'), `
  /**
  * @param {!Person} person
  */`);
    });

    it('generates the correct interface for arrays of interfaces', () => {
      const state = parseCode(`interface Person {
        name: string
        age: number
      }
      class Breadcrumbs extends HTMLElement {
        private render() {}

        public update(people: Person[]) {}
      }`);

      const classOutput = generateClosureClass(state);

      assert.include(classOutput.join('\n'), `
  /**
  * @param {!Array.<!Person>} people
  */`);
    });

    it('generates the correct interface for arrays of primitives', () => {
      const state = parseCode(`class Breadcrumbs extends HTMLElement {
        private render() {}

        public update(people: string[]) {}
      }`);

      const classOutput = generateClosureClass(state);

      assert.include(classOutput.join('\n'), `
  /**
  * @param {!Array.<string>} people
  */`);
    });

    it('generates the correct interface for optional arrays of primitives', () => {
      const state = parseCode(`class Breadcrumbs extends HTMLElement {
        private render() {}

        public update(people?: string[]) {}
      }`);

      const classOutput = generateClosureClass(state);

      assert.include(classOutput.join('\n'), `
  /**
  * @param {(!Array.<string>|undefined)=} people
  */`);
    });

    it('generates the correct interface for optional arrays of interfaces', () => {
      const state = parseCode(`interface Person {
        name: string
        age: number
      }
      class Breadcrumbs extends HTMLElement {
        private render() {}

        public update(people?: Person[]) {}
      }`);

      const classOutput = generateClosureClass(state);

      assert.include(classOutput.join('\n'), `
  /**
  * @param {(!Array.<!Person>|undefined)=} people
  */`);
    });

    it('correctly marks interface parameters as optional but not null', () => {
      const state = parseCode(`interface Person {
        name: string
        age: number
      }
      class Breadcrumbs extends HTMLElement {
        private render() {}

        public update(person?: Person) {}
      }`);

      const classOutput = generateClosureClass(state);

      assert.include(classOutput.join('\n'), `
  /**
  * @param {!Person=} person
  */`);
    });

    it('correctly marks primitive parameters as optional', () => {
      const state = parseCode(`class Breadcrumbs extends HTMLElement {
        private render() {}

        public update(name?: string) {}
      }`);

      const classOutput = generateClosureClass(state);

      assert.include(classOutput.join('\n'), `
  /**
  * @param {(string|undefined)=} name
  */`);
    });

    it('correctly deals with primitives that are not optional', () => {
      const state = parseCode(`class Breadcrumbs extends HTMLElement {
        private render() {}

        public update(name: string) {}
      }`);

      const classOutput = generateClosureClass(state);

      assert.include(classOutput.join('\n'), `
  /**
  * @param {string} name
  */`);
    });

    it('deals with union types in parameters', () => {
      const state = parseCode(`interface Person {
        name: string
        age: number
      }
      class Breadcrumbs extends HTMLElement {
        private render() {}

        public update(person: Person | null) {}
      }`);

      const classOutput = generateClosureClass(state);

      assert.include(classOutput.join('\n'), `
  /**
  * @param {?Person} person
  */`);
    });

    it('parses getter functions', () => {
      const state = parseCode(`interface Person {
        name: string
        age: number
      }
      class Breadcrumbs extends HTMLElement {
        public get person(): Person {
        }
      }`);

      const classOutput = generateClosureClass(state);

      assert.include(classOutput.join('\n'), `
  /**
  * @return {!Person}
  */`);

      assert.include(classOutput.join('\n'), 'get person() {}');
    });

    it('throws on a getter that has no return type', () => {
      const state = parseCode(`interface Person {
        name: string
        age: number
      }
      class Breadcrumbs extends HTMLElement {
        public get person() {
        }
      }`);

      assert.throws(() => generateClosureClass(state), 'Found invalid getter with no return type: person');
    });

    it('handles getter functions with optional return', () => {
      const state = parseCode(`interface Person {
        name: string
        age: number
      }
      class Breadcrumbs extends HTMLElement {
        public get person(): Person | null {
        }
      }`);

      const classOutput = generateClosureClass(state);

      assert.include(classOutput.join('\n'), `
  /**
  * @return {?Person}
  */`);

      assert.include(classOutput.join('\n'), 'get person() {}');
    });

    it('parses setter functions', () => {
      const state = parseCode(`interface Person {
        name: string
        age: number
      }
      class Breadcrumbs extends HTMLElement {
        public set person(person: Person) {
        }
      }`);

      const classOutput = generateClosureClass(state);

      assert.include(classOutput.join('\n'), `
  /**
  * @param {!Person} person
  */`);

      assert.include(classOutput.join('\n'), 'set person(person) {}');
    });

    it('throws on a setter that has no parameter', () => {
      const state = parseCode(`interface Person {
        name: string
        age: number
      }
      class Breadcrumbs extends HTMLElement {
        public set person() {
        }
      }`);

      assert.throws(() => generateClosureClass(state), 'Found invalid setter with no parameter: person');
    });

    it('throws on a setter that has an untyped parameter', () => {
      const state = parseCode(`interface Person {
        name: string
        age: number
      }
      class Breadcrumbs extends HTMLElement {
        public set person(p) {
        }
      }`);

      assert.throws(() => generateClosureClass(state), 'Found invalid setter with no explicit parameter type: person');
    });

    it('handles setter functions with optional parameters', () => {
      const state = parseCode(`interface Person {
        name: string
        age: number
      }
      class Breadcrumbs extends HTMLElement {
        public set person(person?: Person) {
        }
      }`);

      const classOutput = generateClosureClass(state);

      assert.include(classOutput.join('\n'), `
  /**
  * @param {!Person=} person
  */`);

      assert.include(classOutput.join('\n'), 'set person(person) {}');
    });

    it('handles object parameters in setters', () => {
      const state = parseCode(`interface Person {
        name: string
        age: number
      }

      class Breadcrumbs extends HTMLElement {
        public set data(data: { person: Person, somethingElse: number }) {
        }
      }`);

      const classOutput = generateClosureClass(state);

      assert.include(classOutput.join('\n'), `
  /**
  * @param {{person: !Person, somethingElse: number}} data
  */`);

      assert.include(classOutput.join('\n'), 'set data(data) {}');
    });

    it('correctly handles Readonly and outputs the inner type', () => {
      const state = parseCode(`interface Person {
        name: string
        age: number
      }

      class Breadcrumbs extends HTMLElement {
        public set data(data: { person: Readonly<Person> }) {
        }
      }`);

      const classOutput = generateClosureClass(state);

      assert.include(classOutput.join('\n'), `
  /**
  * @param {{person: !Person}} data
  */`);

      assert.include(classOutput.join('\n'), 'set data(data) {}');
    });

    it('correctly handles ReadonlyArray and outputs the inner type', () => {
      const state = parseCode(`interface Person {
        name: string
        age: number
      }

      class Breadcrumbs extends HTMLElement {
        public set data(data: { person: ReadonlyArray<Person> }) {
        }
      }`);

      const classOutput = generateClosureClass(state);

      assert.include(classOutput.join('\n'), `
  /**
  * @param {{person: !Array.<!Person>}} data
  */`);

      assert.include(classOutput.join('\n'), 'set data(data) {}');
    });
  });

  describe('generateInterfaces', () => {
    it('only generates interfaces taken by public methods', () => {
      const state = parseCode(`interface Person {
        name: string
        age: number
      }

      interface Dog {
        name: string
        goodDog: boolean
      }

      class Breadcrumbs extends HTMLElement {
        private render(dog: Dog) {}

        public update(person: Person) {}
      }`);

      const interfaces = generateInterfaces(state);

      assert.strictEqual(interfaces.length, 1);
      assert.isTrue(interfaces[0].join('').includes('export let Person'));
    });

    it('pulls out interfaces when a method takes an array of them', () => {
      const state = parseCode(`interface Person {
        name: string
        age: number
      }

      interface Dog {
        name: string
        goodDog: boolean
      }

      class Breadcrumbs extends HTMLElement {
        private render(dog: Dog) {}

        public update(people: Person[]) {}
      }`);

      const interfaces = generateInterfaces(state);

      assert.strictEqual(interfaces.length, 1);
      assert.isTrue(interfaces[0].join('').includes('export let Person'));
    });

    it('pulls out interfaces from a Readonly helper type', () => {
      const state = parseCode(`interface Person {
        name: string
        age: number
      }

      interface Dog {
        name: string
        goodDog: boolean
      }

      class Breadcrumbs extends HTMLElement {
        public update(people: ReadonlyArray<Person>, dog: Readonly<Dog>) {}
      }`);

      const interfaces = generateInterfaces(state);

      assert.strictEqual(interfaces.length, 2);
      assert.isTrue(interfaces[0].join('').includes('export let Person'));
      assert.isTrue(interfaces[1].join('').includes('export let Dog'));
    });

    it('can convert a basic interface into a Closure one', () => {
      const state = parseCode(`interface Person {
        name: string
        age: number
      }

      class Breadcrumbs extends HTMLElement {
        public update(person: Person) {}
      }`);

      const interfaces = generateInterfaces(state);

      assert.strictEqual(interfaces.length, 1);
      assert.include(interfaces[0].join('\n'), `* @typedef {{
* name:string,
* age:number,
* }}`);
    });

    it('can convert interfaces that include a union type', () => {
      const state = parseCode(`interface Person {
        name: 'jack'|'paul'|'tim';
        age: number;
      }

      class Breadcrumbs extends HTMLElement {
        public update(person: Person) {}
      }`);

      const interfaces = generateInterfaces(state);

      assert.strictEqual(interfaces.length, 1);
      assert.include(interfaces[0].join('\n'), `* @typedef {{
* name:"jack"|"paul"|"tim",
* age:number,
* }}`);
    });

    it('can convert interfaces that include a union type defined separately', () => {
      const state = parseCode(`type Name = 'jack'|'paul'|'tim';

      interface Person {
        name: Name;
        age: number;
      }

      class Breadcrumbs extends HTMLElement {
        public update(person: Person) {}
      }`);

      const interfaces = generateInterfaces(state);

      assert.strictEqual(interfaces.length, 2);
      assert.include(interfaces[0].join('\n'), `* @typedef {{
* name:Name,
* age:number,
* }}`);
      assert.include(interfaces[0].join('\n'), 'export let Person');

      assert.include(interfaces[1].join('\n'), '* @typedef {{"jack"|"paul"|"tim"}}');
      assert.include(interfaces[1].join('\n'), 'export let Name');
    });

    it('supports unions of interfaces', () => {
      const state = parseCode(`type Animal = Dog|Cat;

      interface Dog {
        name: string;
      }

      interface Cat {
        name: string;
      }

      class Breadcrumbs extends HTMLElement {
        public update(animal: Animal) {}
      }`);

      const interfaces = generateInterfaces(state);

      assert.strictEqual(interfaces.length, 3);
      assert.include(interfaces[0].join('\n'), '* @typedef {{Dog|Cat}}');
      assert.include(interfaces[0].join('\n'), 'export let Animal');

      assert.include(interfaces[1].join('\n'), `* @typedef {{
* name:string,
* }}`);
      assert.include(interfaces[1].join('\n'), 'export let Dog');

      assert.include(interfaces[2].join('\n'), `* @typedef {{
* name:string,
* }}`);
      assert.include(interfaces[2].join('\n'), 'export let Cat');
    });

    it('supports unions of interfaces and types', () => {
      const state = parseCode(`type Animal = Dog|Cat;

      interface Dog {
        name: string;
      }

      type Cat = {
        name: string;
      }

      class Breadcrumbs extends HTMLElement {
        public update(animal: Animal) {}
      }`);

      const interfaces = generateInterfaces(state);

      assert.strictEqual(interfaces.length, 3);
      assert.include(interfaces[0].join('\n'), '* @typedef {{Dog|Cat}}');
      assert.include(interfaces[0].join('\n'), 'export let Animal');

      assert.include(interfaces[1].join('\n'), `* @typedef {{
* name:string,
* }}`);
      assert.include(interfaces[1].join('\n'), 'export let Dog');

      assert.include(interfaces[2].join('\n'), `* @typedef {{
* name:string,
* }}`);
      assert.include(interfaces[2].join('\n'), 'export let Cat');
    });

    it('supports unions of interfaces and types and primitives', () => {
      const state = parseCode(`type Animal = Dog|Cat|string|number;

      interface Dog {
        name: string;
      }

      type Cat = {
        name: string;
      }

      class Breadcrumbs extends HTMLElement {
        public update(animal: Animal) {}
      }`);

      const interfaces = generateInterfaces(state);

      assert.strictEqual(interfaces.length, 3);
      assert.include(interfaces[0].join('\n'), '* @typedef {{Dog|Cat|string|number}}');
      assert.include(interfaces[0].join('\n'), 'export let Animal');

      assert.include(interfaces[1].join('\n'), `* @typedef {{
* name:string,
* }}`);
      assert.include(interfaces[1].join('\n'), 'export let Dog');

      assert.include(interfaces[2].join('\n'), `* @typedef {{
* name:string,
* }}`);
      assert.include(interfaces[2].join('\n'), 'export let Cat');
    });

    it('supports unions of interfaces that reference interfaces', () => {
      const state = parseCode(`type Animal = Dog|Cat;

      interface DogFood {
        name: string;
        foodType: 'healthy'|'tasty';
      }
      interface Dog {
        name: string;
        food: DogFood;
      }

      type Cat = {
        name: string;
      }

      class Breadcrumbs extends HTMLElement {
        public update(animal: Animal) {}
      }`);

      const interfaces = generateInterfaces(state);

      assert.strictEqual(interfaces.length, 4);
      assert.include(interfaces[0].join('\n'), '* @typedef {{Dog|Cat}}');
      assert.include(interfaces[0].join('\n'), 'export let Animal');

      assert.include(interfaces[1].join('\n'), `* @typedef {{
* name:string,
* food:DogFood,
* }}`);
      assert.include(interfaces[1].join('\n'), 'export let Dog');

      assert.include(interfaces[2].join('\n'), `* @typedef {{
* name:string,
* }}`);
      assert.include(interfaces[2].join('\n'), 'export let Cat');

      assert.include(interfaces[3].join('\n'), `* @typedef {{
* name:string,
* foodType:"healthy"|"tasty",
* }}`);
      assert.include(interfaces[3].join('\n'), 'export let DogFood');
    });

    it('converts optional primitives correctly', () => {
      const state = parseCode(`interface Person {
        name?: string
      }

      class Breadcrumbs extends HTMLElement {
        public update(person: Person) {}
      }`);

      const interfaces = generateInterfaces(state);

      assert.strictEqual(interfaces.length, 1);
      assert.include(interfaces[0].join('\n'), `* @typedef {{
* name:(string|undefined),
* }}`);
    });

    it('converts optional non-primitives correctly', () => {
      const state = parseCode(`interface Person {
        pet?: Pet
      }

      interface Pet {}

      class Breadcrumbs extends HTMLElement {
        public update(person: Person) {}
      }`);

      const interfaces = generateInterfaces(state);

      assert.strictEqual(interfaces.length, 2);
      assert.include(interfaces[0].join('\n'), `* @typedef {{
* pet:(!Pet|undefined),
* }}`);
    });

    it('includes the export with the @ts-ignore', () => {
      const state = parseCode(`interface Person {
        name: string
        age: number
      }

      class Breadcrumbs extends HTMLElement {
        public update(person: Person) {}
      }`);

      const interfaces = generateInterfaces(state);

      assert.strictEqual(interfaces.length, 1);
      assert.include(interfaces[0].join('\n'), `// @ts-ignore we export this for Closure not TS
export let Person`);
    });

    it('converts a TS type into a Closure interface', () => {
      const state = parseCode(`type Person = {
        name: string;
        age: number;
      }

      class Breadcrumbs extends HTMLElement {
        public update(person: Person) {}
      }`);

      const interfaces = generateInterfaces(state);

      assert.strictEqual(interfaces.length, 1);
      assert.include(interfaces[0].join('\n'), `* @typedef {{
* name:string,
* age:number,
* }}`);
      assert.include(interfaces[0].join('\n'), 'export let Person');
    });

    it('supports a type that has a nested interface within', () => {
      const state = parseCode(`type Person = {
        name: Name;
        age: number;
      }

      interface Name {
        firstLetter: string;
        rest: string[];
      }

      class Breadcrumbs extends HTMLElement {
        public update(person: Person) {}
      }`);

      const interfaces = generateInterfaces(state);

      assert.strictEqual(interfaces.length, 2);
      assert.include(interfaces[0].join('\n'), `* @typedef {{
* name:Name,
* age:number,
* }}`);
      assert.include(interfaces[0].join('\n'), 'export let Person');
      assert.include(interfaces[1].join('\n'), `* @typedef {{
* firstLetter:string,
* rest:Array.<string>,
* }}`);
      assert.include(interfaces[1].join('\n'), 'export let Name');
    });

    it('pulls out a type that is nested within an interface', () => {
      const state = parseCode(`interface Person {
        name: Name;
        age: number;
      }

      type Name = {
        firstLetter: string;
        rest: string[];
      }

      class Breadcrumbs extends HTMLElement {
        public update(person: Person) {}
      }`);

      const interfaces = generateInterfaces(state);

      assert.strictEqual(interfaces.length, 2);
      assert.include(interfaces[0].join('\n'), `* @typedef {{
* name:Name,
* age:number,
* }}`);
      assert.include(interfaces[0].join('\n'), 'export let Person');
      assert.include(interfaces[1].join('\n'), `* @typedef {{
* firstLetter:string,
* rest:Array.<string>,
* }}`);
      assert.include(interfaces[1].join('\n'), 'export let Name');
    });

    it('understands types that extend other types and fully defines them', () => {
      const state = parseCode(`type NamedThing = {
        name: string;
      }

      type Person = NamedThing & {
        age: number;
      }

      class Breadcrumbs extends HTMLElement {
        public update(person: Person) {}
      }`);

      const interfaces = generateInterfaces(state);

      assert.strictEqual(interfaces.length, 1);
      assert.include(interfaces[0].join('\n'), `* @typedef {{
* name:string,
* age:number,
* }}`);
      assert.include(interfaces[0].join('\n'), 'export let Person');
    });

    it('understands types that extend other types with no object literals', () => {
      const state = parseCode(`type NamedThing = {
        name: string;
      }

      type AgedThing = {
        age: number;
      }

      type Person = NamedThing & AgedThing;

      class Breadcrumbs extends HTMLElement {
        public update(person: Person) {}
      }`);

      const interfaces = generateInterfaces(state);

      assert.strictEqual(interfaces.length, 1);
      assert.include(interfaces[0].join('\n'), `* @typedef {{
* name:string,
* age:number,
* }}`);
      assert.include(interfaces[0].join('\n'), 'export let Person');
    });

    it('correctly picks the right most field when a type extends a type and overrides a field', () => {
      const state = parseCode(`type NamedThing = {
        name: string;
      }

      type AgedThing = {
        age: number;
      }

      type Person = NamedThing & AgedThing & { name: 'jack' };

      class Breadcrumbs extends HTMLElement {
        public update(person: Person) {}
      }`);

      const interfaces = generateInterfaces(state);

      assert.strictEqual(interfaces.length, 1);
      assert.include(interfaces[0].join('\n'), `* @typedef {{
* name:"jack",
* age:number,
* }}`);
      assert.include(interfaces[0].join('\n'), 'export let Person');
    });

    it('correctly includes interfaces from types that get extended', () => {
      const state = parseCode(`type NamedThing = {
        name: string;
        details: Detail[];
      }

      interface Detail {
        id: number;
      }

      type Person = NamedThing & { name: 'jack' };

      class Breadcrumbs extends HTMLElement {
        public update(person: Person) {}
      }`);

      const interfaces = generateInterfaces(state);

      assert.strictEqual(interfaces.length, 2);
      assert.include(interfaces[0].join('\n'), `* @typedef {{
* name:"jack",
* details:Array.<!Detail>,
* }}`);
      assert.include(interfaces[0].join('\n'), 'export let Person');
      assert.include(interfaces[1].join('\n'), `* @typedef {{
* id:number,
* }}`);
      assert.include(interfaces[1].join('\n'), 'export let Detail');
    });

    it('correctly includes interfaces from types that get extended with object literals', () => {
      const state = parseCode(`interface Detail {
        id: number;
      }

      type NamedThing = {
        name: string;
      }

      type Person = NamedThing & { details: Detail[] };

      class Breadcrumbs extends HTMLElement {
        public update(person: Person) {}
      }`);

      const interfaces = generateInterfaces(state);

      assert.strictEqual(interfaces.length, 2);
      assert.include(interfaces[0].join('\n'), `* @typedef {{
* name:string,
* details:Array.<!Detail>,
* }}`);
      assert.include(interfaces[0].join('\n'), 'export let Person');
      assert.include(interfaces[1].join('\n'), `* @typedef {{
* id:number,
* }}`);
      assert.include(interfaces[1].join('\n'), 'export let Detail');
    });
  });
});
