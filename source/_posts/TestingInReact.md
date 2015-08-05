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
date: 2015-08-04 16:00:00
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
Utility Patterns: WithMocks

```javascript my-component-spec.jsx
  it('should be rendered with an Avatar as a child', () => {
    profile = TestUtils.renderIntoDocument(<Profile />);
    var child = ReactTestUtils.findRenderedComponentWithType(Profile, Avatar);
    expect(ReactTestUtils.isCompositeComponentWithType(child, Avatar)).toBe(true);
  });
```

If you have mocked the child components, then you need to search for the mocked classes:
```javascript my-component-mocked-spec.jsx

  class MockAvatar extends React.Component {
    render () {...}
  }

  it('should be rendered with an Avatar as a child', () => {
    withMocks(Profile, {
      Avatar: MockAvatar
    }, () => {
      profile = TestUtils.renderIntoDocument(<Profile />);
      var child = ReactTestUtils.findRenderedComponentWithType(Profile, MockAvatar);
      expect(ReactTestUtils.isCompositeComponentWithType(child, Avatar)).toBe(true);
    });
  });
```

## Verify Component has X Children
Utility Patterns: None

```javascript my-component-spec.jsx
  it('should be rendered with several child Profiles', () => {
    profileList = TestUtils.renderIntoDocument(<ProfileList />);
    var children = ReactTestUtils.scryRenderedComponentsWithType(profileList, Profile);
    expect(children.length).toBe(5);
  });
```

## Verify Component Passes the Correct Props to its Child
Utility Patterns: None

Props are persistent for the current 'render' of a component, and thus can be easily referred to at any point in a components lifetime.

```javascript my-component-spec.jsx
  it('should pass the correct value into its child Avatar', () => {
    profile = TestUtils.renderIntoDocument(<Profile />);
    var avatar = ReactTestUtils.findRenderedComponentWithType(profile, Avatar);
    expect(avatar.props.url).toBe(profile.state.mainAvatarUrl);
  });
```

## Verify Components Callback is Called with the Correct Params
Utility Patterns: WaitFor

```javascript my-component-spec.jsx
  it('should call the onClose callback and pass in the accountLists id when close is clicked', (done) => {
    var wasCallbackCalledCorrectly = false;
    accountList = TestUtils.renderIntoDocument(<AccountList id={42} onClose={(id) => {
      wasCallbackCalledCorrectly = id === 42;
    }} />);
    
    TestUtils.Simulate.click(React.findDOMNode(accountList.refs.closeButton));
    waitFor(() => wasCallbackCalledCorrectly, 'The onClose callback was not called when close was clicked', done);
  });
```

## Verify Components Callback is Not Called
Utility Patterns: Then

```javascript my-component-spec.jsx
  it('should not call the onClose callback when close is clicked but there is a warning', (done) => {
    accountList = TestUtils.renderIntoDocument(<AccountList
      initialWarning='No profiles found. Please add at least one profile'
      onClose={() => {
        fail('The close callback was called while the account list contains a warning');
        done(); // ensure we don't waste time waiting for the test to time out
      }}
    />);
    
    TestUtils.Simulate.click(React.findDOMNode(accountList.refs.closeButton));
    then(() => done(), 100); // give the component 100ms to fail, then assume it hasn't called it
  });
```

## Verify Components Callback is Called within a Specific Time-Window
Utility Patterns: WaitFor, Then

```javascript my-component-spec.jsx
  // Perhaps you want there to be a visual lag, so a process should take between x and y seconds #contrivedExample
  it('should call the onDataReceived callback between 1 and 2 seconds of clicking the refresh button', (done) => {
    var wasCallbackCalled = false;
    accountList = TestUtils.renderIntoDocument(<AccountList onDataReceived={() => {
      wasCallbackCalled = true;
    }} />);
    
    TestUtils.Simulate.click(React.findDOMNode(accountList.refs.refreshButton));
    then(() => {
      expect(wasCallbackCalled).toBe(false);
      then(() => {
        waitFor(() => wasCallbackCalled, 'The onDataReceived callback was not called soon enough', done, 1025);
      });
    }, 975);
  });
```

## Verify Components State is Correct after a Click
Utility Patterns: Then, WaitFor

```javascript my-component-spec.jsx
  it('should store the selected Account when one is clicked', (done) => {
    var accounts = [1,2,3].map(() => createTestAccountData());
    var accountList = TestUtils.renderIntoDocument(<AccountList accounts={accounts} />);
    
    // unlike re-rendering after a setState, renderIntoDocument will block until the component is rendered, so we can use it right away
    var accountToClick = TestUtils.scryRenderedComponentsWithType(accountList, Account)[1];
    TestUtils.Simulate.click(React.findDOMNode());
    
    then(() => {
      expect(accountList.state.selectedAccounts).toEqual([accounts[1]);
    });
    
    //OR
    
    waitFor(
      () => accountList.state.selectedAccounts.length === 1 && accountList.state.selectedAccounts[0] === accounts[1],
      'The Account was not selected after clicking it',
      done
    );
  });
```

## Verify Components State is Correct after Typing
Utility Patterns: WaitFor
```javascript my-component-spec.jsx
  it('should change the search query state after the user types in a name', (done) => {
    var accountList = TestUtils.renderIntoDocument(<AccountList accounts={accounts} />);
    var searchBoxNode = React.findDOMNode(accountList.refs.searchBoxInput);
    
    searchBoxNode.value = 'Smitty Johnson';
    ReactTestUtils.Simulate.change(searchBoxNode);
    
    waitFor(
      () => accountlist.state.searchString === 'Smitty Johnson',
      'The search query was not updated after entering in a search string',
      done
    );
  });
```

## Verify Components State is Correct after a Sequence of Events
Utility Patterns: Then

```javascript my-component-spec.jsx
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



# Utility Patterns
These patterns can make your life a lot easier, and make your tests cleaner to boot. I hesitate to call them libraries as they will likely have to be tuned to your specific scenario, and there are still edge cases that are not fully handled here. But by using them as building blocks, you should be able to extrapolate to solve various problems you might encounter.

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
    // we gave this one an extra 100 ms, so we need to nest further thens to ensure they run in order
    TestUtils.Simulate.click(React.findDOMNode(component));
    then(() => {
      expect(...);
      done();
    });
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

## WithMocksBeforeEach
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
var rewire = require('rewire');

var LatestArticleButton = rewire('src/components/latest-article-button');

describe('The get latest article button', () => {
  var mockAjaxRequest = (url, callback) => callback({success: true, content: ""});
  var mockDatabase = {select: (table, command) => [], createTable: () => null};
  
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

## WithMocks
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
var rewire = require('rewire');

var LatestArticleButton = rewire('src/components/latest-article-button');

describe('The get latest article button', () => {
  var mockAjaxRequest = (url, callback) => callback({success: true, content: ""});
  var mockDatabase = {select: (table, command) => [], createTable: () => null};
  
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

## TestUtils.mockComponent wont create basic mocks
[According to the React TestUtils Docs](https://facebook.github.io/react/docs/test-utils.html#mockcomponent), you can use TestUtils.mockComponent() to create a quick mock that simply renders an empty div. However, what is not documented is that this feature is only available if you are using Jest.

The intended use case is:
```javascript jest.jsx
TestUtils.mockComponent(jest.genMockFunction());
```

If you do need a basic dummy component, you can simply create a shared inline mock component:
```javascript basic-mock.jsx
class MockedSubComponent extends React.Component {
  render () {
    return <div></div>;
  }
}
```

## Expectations won't print inside asynchronous tests
For a regular test, you utilize _expect_ to ensure your conditions are met, and depend on its output to tell you where and why something failed. However, within an asynchronous test, this output will not come out, and instead your test will block for some time (default 5 seconds) and then fail with a generic Async timeout failure.

The solution to this is to simply manually call fail.
```javascript async-failure-integration-spec.jsx
  it('should update the account name if its empty and we refresh it', (done) => {
    var accountDisplay = TestUtils.renderIntoDocument(AccountDisplay);
    TestUtils.Simulate.click(React.findDOMNode(accountDisplay.refs.refreshButton));
    
    // We should use the WaitFor pattern here, but I'll show it without it to illustrate the manual failure
    setTimeout(() => {
      // if we call expect here and it fails, we won't get the right error message, but instead an async timeout message
      if (accountDisplay.state.accountName !== 'Test Account 1234') {
        fail('The account name was not updated after refreshing the display and waiting 2 seconds. Found: ' + accountDisplay.state.accountName);
      }
      done(); // the done call ensures our test does not timeout, nor waste any extra time. It is called even if fail was called
    }, 2000);
  });
```

This is also how the WaitFor pattern works.

## Mocked dependencies must be searched for my their mock class
Mocking with rewire in javascript does not provide full polymorphism - if you override a mock class my name, any reference to the original will now be a mock component, but the _type_ of the new components will be MockComponent.
 
This means you have to search for sub-components by their mock classes name, rather than their original name:
```javascript my-component-mocked-spec.jsx

  class MockAvatar extends React.Component {
    render () {...}
  }

  it('should be rendered with an Avatar as a child', () => {
    withMocks(Profile, {
      Avatar: MockAvatar
    }, () => {
      profile = TestUtils.renderIntoDocument(<Profile />);
      
      // Wrong
      var child = ReactTestUtils.findRenderedComponentWithType(Profile, Avatar);
      expect(ReactTestUtils.isCompositeComponentWithType(child, Avatar)).toBe(true);

      // Right
      var child = ReactTestUtils.findRenderedComponentWithType(Profile, MockAvatar);
      expect(ReactTestUtils.isCompositeComponentWithType(child, MockAvatar)).toBe(true);
    });
  });
```

This does not change how your component has to use the mocked component - it's just a technicality you have to watch out for from outside of the component.
