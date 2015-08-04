title: Testing in React
tags:
  - javascript
  - react
  - testing
  - unittest
  - coverage
  - jasmine
  - karma
  - mocking
  - rewire
author: Brandon Okert
date: 2015-08-02 14:06:58
thumbnailImage: thumbnail.png
summary: An Overview of Common Test Scenarios and Gotchas in ReactJs
---

Having recently been tasked with bringing our JS test coverage in React to >85%, I was surprised to find that there are scant resources for actually testing React components thoroughly. There are a few Test Utilities and getting started guides, but few examples to draw from for for in depth coverage. What do I do when I need to test a change in state resulting from a sequence of user actions? How can I verify a callback occurs at the correct time? How can I create effective mocks without drastically changing my architecture?

Through building up our own coverage, I've collected several such scenarios and gotchas that one is likely to encounter.
 
<!-- toc -->

# Scenarios
The code examples are all written in the React Transpilers subset of ES6, and in Jasmine/Karma style. However, any toolset that allows manual control of test completion (for asynchronous testing) should be fine. 

In addition, many scenarios make use of Test Utilities. These will be referred to by name in the "Utility Patterns" heading of each scenario.

## Verify Component Renders with the Correct DOM
Utility Patterns: None
```javascript my-component.jsx
class MyComponent extends React.Component {
  render () {
    var children = this.props.children.map((child) => {
      return (<li className='child'>{child.sex === 'm' ? 'Son: ' : 'Daughter: '} Name: {child.name} ({child.age})</li>);
    });
    
    return (
      <div className='container -large'>
        <ul>
          <li>Name: {this.props.name}</li>
          {children}
        </ul>
      </div>
    );
  }
}
```

```javascript my-component-spec.jsx
var TestUtils = require('react/lib/ReactTestUtils');
var MyComponent = require('src/components/my-component');

describe('MyComponent', () => {
  it('should render with the correct DOM', () => {
    var children = [
      {name: "Billy", age: 4, sex: 'm'},
      {name: "Sally", age: 6, sex: 'f'},
    ];
    var myComponent = TestUtils.renderIntoDocument(<MyComponent children=/>);
    var renderedDOM = () => React.findDOMNode(myComponent);
    
    expect(renderedDOM.tagName).toBe('div');
    expect(renderedDOM.classList).toEqual(['container', '-large']);
    //...
      
    var children = renderedDOM.querySelectorAll('li.child');
    expect(children.length).toBe(2);
    expect(children[0]).toEqual({name: "Billy", age: 4, sex: 'm'});
    //...
  });
});
```

## Verify Component Renders its Child Components
Utility Patterns: None

## Verify Component has X Children
Utility Patterns: None

## Verify Component Passes the Correct Props to its Child
Utility Patterns: None

## Verify Components Callback is Called with the Correct Params
Utility Patterns: None

## Verify Components Callback is Not Called
Utility Patterns: None

## Verify Components Child Calls its Passed Callback
Utility Patterns: None

## Verify Components Callback is Called within a Specific Time-Window
Utility Patterns: None

## Verify Components State is Correct after a Click
Utility Patterns: None

## Verify Components State is Correct after Typing
Utility Patterns: None

## Verify Components State is Correct after a Sequence of Events
Utility Patterns: None

# Utility Patterns
These patterns can make your life a lot easier, and make your tests cleaner to boot. Apply liberally.

## Then
The Then pattern is good for sequencing of events in the event loop. Most things in React (changing this.state after a setState(), rendering after a setState) are queued immediately, so simply ensuring things run in order can make them easy to test.
We can use expect(...) within Then's without any surprises.
```javascript then.js
var then = function (callback, timeout) {
  setTimeout(callback, timeout > 0 ? timeout : 0);
  return {then: then};
};

module.exports = then;
```

```javascript then-spec.jsx
var then = require('lib/then');

it('should ...', (done) => {
  var component = ...;
  TestUtils.Simulate.click(React.findDOMNode(component));
  then(() => {
    TestUtils.Simulate.click(React.findDOMNode(component));
  }).then(() => {
    TestUtils.Simulate.click(React.findDOMNode(component));
  }).then(() => {
    // we gave this one an extra 100 ms
    expect(...);
    done();
  }, 100);
});
```
## WaitFor
The WaitFor pattern is an extension of the then pattern, but instead of always doing something after a timeout, it waits for a condition to be true. This is useful primarily for asynchronous callbacks.
```javascript wait-for.js
var waitsInProgress = [];

var waitFor = (test, message, done, timeLeft) => {
  timeLeft = timeLeft === undefined ? 100 : timeLeft;
  waitsInProgress.push(setTimeout(() => {
    if (timeLeft <= 0) {
      fail(message);
      done();
    } else if (test()) {
      done();
    } else {
      waitFor(test, message, done, timeLeft - 10);
    }
  }, 10));
};

waitFor.clear = () => waitsInProgress.map(clearTimeout); //optionally call this in the beforeEach to ensure rogue tests are not still waiting

module.exports = waitFor;
```

We manually call fail within the waitFor, since asynchronous callbacks will not display the output of an expect upon failure.
In jasmine, if you want to wait for longer than 5 seconds (not recommended for unit tests) you need to set the max timeout in the last argument of your 'it' function.

```javascript wait-for-spec.jsx
var waitFor = require('lib/waitFor');

it('should ...', (done) => {
  var component = ...;
  TestUtils.Simulate.click(React.findDOMNode(component));
  waitFor(
    () => component.state.isSelected,
    'The component was not selected after clicking it',
    done
  );
});

it('should wait for a long process', (done) => {
  var component = ...;
  TestUtils.Simulate.click(React.findDOMNode(component));
  waitFor(
    () => component.state.ajaxResult,
    'The component did not store the ajax response after clicking it and waiting 10 seconds',
    done,
    10000
  );
}, 10500);
```

## withMocksBeforeEach
This is a useful pattern to use along with a rewired component and some mocks. Simply specify that for all of the following tests, the dependencies of the component are to be replaced by the given mocks. Great for mocking things like ajaxServices.
Kreds to [Alex Boissiére](https://twitter.com/theasta) for the original implementation.

```javascript with-mocks-before-each.js
var withMocksBeforeEach = function withMocksBeforeEach(rewiredModule, varValues) {
  var rewiredReverts = [];

  beforeEach(function() {
    var key, value, revert;
    for (key in varValues) {
      if (varValues.hasOwnProperty(key)) {
        value = varValues[key];
        revert = rewiredModule.__set__(key, value);
        rewiredReverts.push(revert);
      }
    }
  });

  afterEach(function() {
    rewiredReverts.forEach(function(revert) {
      revert();
    });
  });

  return withMocksBeforeEach;
};

module.exports = withMocksBeforeEach;
```

```javascript with-mocks-before-each-spec.jsx
var withMocksBeforeEach = require('lib/withMocksBeforeEach');

describe('The get latest article button', () => {
  var mockAjaxRequest = (url, callback) => callback({success: true, content: ""});
  var mockDatabase = {select: (table, command) => [], createTable: () => null};
  
  var LatestArticleButton = rewire('src/components/latest-article-button');
  
  withMocksBeforeEach(LatestArticleButton, {
    ajaxRequest: mockAjaxRequest,
    factsDatabase: mockDatabase
  });
  
  it('should render a sorry message if an article is returned successfully but is empty', () => {
    var component = React.renderIntoDocument(<LatestArticleButton />);
    TestUtils.Simulate.click(component.findDOMElement); // will eventually make an ajaxRequest
    waitFor(() => component.state.overlayMessage === 'That article is no longer available', 'The correct error was not displayed', done);
  });
});
```

## withMocks
This is similar to the withMocksBeforeEach pattern, but can be applied to individual tests. Good for when some mocks are shared, and some are particular to only a single test.

```javascript with-mocks.js
var withMocks = function withMocks(dut, mockedDependencies, test) {
  var rewiredReverts = [];

  var key, value, revert;
  for (key in mockedDependencies) {
    if (mockedDependencies.hasOwnProperty(key)) { 
      value = mockedDependencies[key];
      revert = dut.__set__(key, value);
      rewiredReverts.push(revert);
    }
  }

  var testThenCleanup = function() {
    test();
    rewiredReverts.forEach(function(revertToCall) {
      revertToCall();
    });
  };

  testThenCleanup();
};

module.exports = withMocks;
```

```javascript with-mocks-spec.jsx
var withMocks = require('lib/withMocks');

describe('The get latest article button', () => {
  var mockAjaxRequest = (url, callback) => callback({success: true, content: ""});
  var mockDatabase = {select: (table, command) => [], createTable: () => null};
  
  var LatestArticleButton = rewire('src/components/latest-article-button');
  
  it('should render a sorry message if an article is returned successfully but is empty', () => {
    withMocks(LatestArticleButton, {
      ajaxRequest: mockAjaxRequest,
      factsDatabase: mockDatabase
    }, () => {
      var component = React.renderIntoDocument(<LatestArticleButton />);
      TestUtils.Simulate.click(component.findDOMElement); // will eventually make an ajaxRequest
      waitFor(() => component.state.overlayMessage === 'That article is no longer available', 'The correct error was not displayed', done);
    });
  });
});
```

# Gotchas

## You Cannot Check State/Render or Simulate Right After Simulating an Event
This will seem obvious if you've already gone through some of the scenarios. Consider the following test:
```javascript gotcha-spec.js
it('should add the clicked account to the list of selected accounts', () => {
  accountSelector = TestUtils.renderIntoDocument(<AccountSelector accounts={[...]} accountGroups={[...]} />);
  
  var accounts = TestUtils.scryRenderedComponentsWithType(accountSelector, Account);
  TestUtils.Simulate.click(accounts[1]);
  expect(accountSelector.state.selectedAccounts.length).toBe(1);
});
```

This will fail, saying that accountSelector.state.selectedAccounts.length is 0, which it is.
When we clicked the account, we triggered a setState, which will in turn change the actual state, as well as re-render. However, both of these are not done synchronously - they are added to the next slot in the event loop.

This applies to sequences of simulations as well:
```javascript gotcha-spec.js
it('should de-select any accounts when I select an account group', () => {
  accountSelector = TestUtils.renderIntoDocument(<AccountSelector accounts={[...]} accountGroups={[...]} />);

  var accounts = TestUtils.scryRenderedComponentsWithType(accountSelector, Account);
  var accountGroup = TestUtils.findRenderedComponentWithType(accountSelector, AccountGroup);
  
  TestUtils.Simulate.click(accounts[1]);
  TestUtils.Simulate.click(accounts[2]);
  TestUtils.Simulate.click(accounts[4]);
  expect(accountSelector.state.selectedAccounts.length).toBe(3);
  TestUtils.Simulate.click(accountGroup);
  expect(accountSelector.state.selectedAccounts.length).toBe(0);
});
```

The operation of these simulations all depend on the state and DOM generated by the previous actions, and thus the result will not be what you expect.

The solution to both of these problems is to use the Then pattern, or the WaitFor pattern, along with manual termination of tests:
```javascript gotcha-covered-spec.js
it('should add the clicked account to the list of selected accounts', (done) => {
  accountSelector = TestUtils.renderIntoDocument(<AccountSelector accounts={[...]} accountGroups={[...]} />);
  
  var accounts = TestUtils.scryRenderedComponentsWithType(accountSelector, Account);
  TestUtils.Simulate.click(accounts[1]);
  then(() => {
    expect(accountSelector.state.selectedAccounts.length).toBe(1);
    done();
  });
  
  //OR
  
  waitFor(() => accountSelector.state.selectedAccounts.length === 1, 'The selectedAccounts list was not updated after clicking an account', done);
});
```

See the next Gotcha for an example of proper sequencing for Simulations.

## You Cannot Simulate Events in Series Without Re-Finding DOM Components
Consider the following test, where we already know we have to sequence our simulations:
```javascript gotcha-spec.js
it('should de-select any accounts when I select an account group', (done) => {
  accountSelector = TestUtils.renderIntoDocument(<AccountSelector accounts={[...]} accountGroups={[...]} />);

  var accounts = TestUtils.scryRenderedComponentsWithType(accountSelector, Account);
  var accountGroup = TestUtils.findRenderedComponentWithType(accountSelector, AccountGroup);
  
  TestUtils.Simulate.click(accounts[1]);
  then(() => {
    TestUtils.Simulate.click(accounts[2]);
  }).then(() => {
    TestUtils.Simulate.click(accounts[4]);
  }).then(() => {
    expect(accountSelector.state.selectedAccounts.length).toBe(3);
    TestUtils.Simulate.click(accountGroup);
  }).then(() => {
    expect(accountSelector.state.selectedAccounts.length).toBe(0);
    done();
  });
});
```

If you run this, you'll right away notice what's wrong: it'll fail with a cryptic error:
```
Error: Invariant Violation: Component (with keys: getDOMNode,props,context,state,refs,_reactInternalInstance) contains `render` method but is not mounted in the DOM
```

This is occurring because you are Simulating an event on a DOM element that is no longer rendered. Via closure, the reference in accounts[2] is still a valid pointer, but it is no longer in the DOM, because clicking on the first button has changed the state, which in turned casues a re-render, replacing the old DOM nodes. After the re-render, we need to re-grab the DOM node that we want to click. 

```javascript gotcha-covered-spec.js
it('should de-select any accounts when I select an account group', (done) => {
  accountSelector = TestUtils.renderIntoDocument(<AccountSelector accounts={[...]} accountGroups={[...]} />);

  var accounts;
  
  accounts = TestUtils.scryRenderedComponentsWithType(accountSelector, Account);
  TestUtils.Simulate.click(accounts[1]);
  then(() => {
    accounts = TestUtils.scryRenderedComponentsWithType(accountSelector, Account);
    TestUtils.Simulate.click(accounts[2]);
  }).then(() => {
    accounts = TestUtils.scryRenderedComponentsWithType(accountSelector, Account);
    TestUtils.Simulate.click(accounts[4]);
  }).then(() => {
    expect(accountSelector.state.selectedAccounts.length).toBe(3);

    var accountGroup = TestUtils.findRenderedComponentWithType(accountSelector, AccountGroup);
    TestUtils.Simulate.click(accountGroup);
  }).then(() => {
    expect(accountSelector.state.selectedAccounts.length).toBe(0);
    done();
  });
});
```

## TestUtils.mockComponent wont create basic mocks for me

## Expectations won't print inside asynchronous tests

## CTRL-C won't always kill a test
