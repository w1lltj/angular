/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import {Component} from '../../src/core';
import {clearResolutionOfComponentResourcesQueue, resolveComponentResources} from '../../src/metadata/resource_loading';
import {ComponentType} from '../../src/render3/interfaces/definition';
import {compileComponent} from '../../src/render3/jit/directive';

describe('resource_loading', () => {
  describe('error handling', () => {
    afterEach(clearResolutionOfComponentResourcesQueue);
    it('should throw an error when compiling component that has unresolved templateUrl', () => {
      const MyComponent: ComponentType<any> = (class MyComponent{}) as any;
      compileComponent(MyComponent, {templateUrl: 'someUrl'});
      expect(() => MyComponent.ngComponentDef).toThrowError(`
Component 'MyComponent' is not resolved:
 - templateUrl: someUrl
Did you run and wait for 'resolveComponentResources()'?`.trim());
    });

    it('should throw an error when compiling component that has unresolved styleUrls', () => {
      const MyComponent: ComponentType<any> = (class MyComponent{}) as any;
      compileComponent(MyComponent, {styleUrls: ['someUrl1', 'someUrl2']});
      expect(() => MyComponent.ngComponentDef).toThrowError(`
Component 'MyComponent' is not resolved:
 - styleUrls: ["someUrl1","someUrl2"]
Did you run and wait for 'resolveComponentResources()'?`.trim());
    });

    it('should throw an error when compiling component that has unresolved templateUrl and styleUrls',
       () => {
         const MyComponent: ComponentType<any> = (class MyComponent{}) as any;
         compileComponent(
             MyComponent, {templateUrl: 'someUrl', styleUrls: ['someUrl1', 'someUrl2']});
         expect(() => MyComponent.ngComponentDef).toThrowError(`
Component 'MyComponent' is not resolved:
 - templateUrl: someUrl
 - styleUrls: ["someUrl1","someUrl2"]
Did you run and wait for 'resolveComponentResources()'?`.trim());
       });
  });

  describe('resolution', () => {
    const URLS: {[url: string]: Promise<string>} = {
      'test://content': Promise.resolve('content'),
      'test://style1': Promise.resolve('style1'),
      'test://style2': Promise.resolve('style2'),
    };
    let resourceFetchCount: number;
    function testResolver(url: string): Promise<string> {
      resourceFetchCount++;
      return URLS[url] || Promise.reject('NOT_FOUND: ' + url);
    }
    beforeEach(() => resourceFetchCount = 0);

    it('should resolve template', async() => {
      const MyComponent: ComponentType<any> = (class MyComponent{}) as any;
      const metadata: Component = {templateUrl: 'test://content'};
      compileComponent(MyComponent, metadata);
      await resolveComponentResources(testResolver);
      expect(MyComponent.ngComponentDef).toBeDefined();
      expect(metadata.templateUrl).toBe(undefined);
      expect(metadata.template).toBe('content');
      expect(resourceFetchCount).toBe(1);
    });

    it('should resolve styleUrls', async() => {
      const MyComponent: ComponentType<any> = (class MyComponent{}) as any;
      const metadata: Component = {template: '', styleUrls: ['test://style1', 'test://style2']};
      compileComponent(MyComponent, metadata);
      await resolveComponentResources(testResolver);
      expect(MyComponent.ngComponentDef).toBeDefined();
      expect(metadata.styleUrls).toBe(undefined);
      expect(metadata.styles).toEqual(['style1', 'style2']);
      expect(resourceFetchCount).toBe(2);
    });

    it('should cache multiple resolution to same URL', async() => {
      const MyComponent: ComponentType<any> = (class MyComponent{}) as any;
      const metadata: Component = {template: '', styleUrls: ['test://style1', 'test://style1']};
      compileComponent(MyComponent, metadata);
      await resolveComponentResources(testResolver);
      expect(MyComponent.ngComponentDef).toBeDefined();
      expect(metadata.styleUrls).toBe(undefined);
      expect(metadata.styles).toEqual(['style1', 'style1']);
      expect(resourceFetchCount).toBe(1);
    });

    it('should keep order even if the resolution is out of order', async() => {
      const MyComponent: ComponentType<any> = (class MyComponent{}) as any;
      const metadata: Component = {
        template: '',
        styles: ['existing'],
        styleUrls: ['test://style1', 'test://style2']
      };
      compileComponent(MyComponent, metadata);
      const resolvers: any[] = [];
      const resolved = resolveComponentResources(
          (url) => new Promise((resolve, response) => resolvers.push(url, resolve)));
      // Out of order resolution
      expect(resolvers[0]).toEqual('test://style1');
      expect(resolvers[2]).toEqual('test://style2');
      resolvers[3]('second');
      resolvers[1]('first');
      await resolved;
      expect(metadata.styleUrls).toBe(undefined);
      expect(metadata.styles).toEqual(['existing', 'first', 'second']);
    });

  });

  describe('fetch', () => {
    function fetch(url: string): Promise<Response> {
      return Promise.resolve({
        text() { return 'response for ' + url; }
      } as any as Response);
    }

    it('should work with fetch', async() => {
      const MyComponent: ComponentType<any> = (class MyComponent{}) as any;
      const metadata: Component = {templateUrl: 'test://content'};
      compileComponent(MyComponent, metadata);
      await resolveComponentResources(fetch);
      expect(MyComponent.ngComponentDef).toBeDefined();
      expect(metadata.templateUrl).toBe(undefined);
      expect(metadata.template).toBe('response for test://content');
    });
  });
});
