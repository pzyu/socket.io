$(function () {
    const FADE_TIME = 150; // ms
    const TYPING_TIMER_LENGTH = 400; // ms
    const COLORS = [
    '#e21400', '#91580f', '#f8a700', '#f78b00',
    '#58dc00', '#287b00', '#a8f07a', '#4ae8c4',
    '#3b88eb', '#3824aa', '#a700ff', '#d300e7'
  ];

    // Initialize variables
    const $window = $(window);
    const $usernameInput = $('.usernameInput'); // Input for username
    const $messages = $('.messages'); // Messages area
    const $inputMessage = $('.inputMessage'); // Input message input box

    const $loginPage = $('.login.page'); // The login page
    const $chatPage = $('.chat.page'); // The chatroom page
    const $todoPage = $('.todo.page'); // The chatroom page

    const $addItemForm = $("#add-item-form");
    const $todoListContainer = $("#todo-list-container");


    let isHost = false;
    let hostTodoList = [];

    const socket = io();

    // Handle adding items    
    $addItemForm.submit(function (e) {
        e.preventDefault();

        // Get all the forms elements and their values in one step
        var values = $(this).serializeArray();

        var item = $("input[name='item']", this).val();
        var owner = $("input[name='owner']", this).val();

        console.log("Item: " + item + " owner: " + owner);

        $(this).trigger("reset");

        let itemData = {
            item: item,
            owner: owner
        }

        socket.emit('new item', itemData);
    });

    const addNewItem = (item, owner) => {
        console.log("Adding new item");

        /*
            <li class="list-group-item" data-owner="owner">
                <label class="item-description">An item</label>
                <label class="item-owner">@ Owner</label>
                <div class="controls item-control-visible">
                    <button class="btn btn-success mx-2">Complete</button>
                    <button class="btn btn-danger mx-2">Delete</button>
                </div>
            </li>
        */

        const $itemDescriptionLabel = $('<label class="item-description ow"></label>')
            .text(item);
        const $itemOwnerLabel = $('<label class="item-owner mx-2 ow"></label>')
            .text("@ " + owner);

        const $controlsDiv = $('<div class="controls item-control-visible"></div>');
        const $completeButton = $('<button class="btn btn-success mx-2">Complete</button>')
            .click(function () {
                removeItem($(this));
            });
        const $deleteButton = $('<button class="btn btn-danger mx-2">Delete</button>')
            .click(function () {
                removeItem($(this));
            });

        $controlsDiv.append($completeButton, $deleteButton);

        const $itemDiv = $('<li class="list-group-item my-2"/>')
            .data('owner', owner)
            .data('item', item)
            .append($itemDescriptionLabel, $itemOwnerLabel);
        
        // If we are host
        if (isHost) {
            addToHostList(item, owner);
            
            $itemDiv.append($controlsDiv);
        }
        
        addNewItemElement($itemDiv);

    }

    const removeItem = (el) => {
        let parentDiv = el.closest(".list-group-item")

        let item = parentDiv.data("item");
        let owner = parentDiv.data("owner");

        let itemData = {
            item: item,
            owner: owner
        }

        socket.emit('remove item', itemData);
    }

    const addNewItemElement = (el) => {
        const $el = $(el);
        $el.hide().fadeIn("normal");
        $todoListContainer.append($el);
    }

    const addToHostList = (item, owner) => {
        var itemData = {
            item: item,
            owner: owner,
        };

        hostTodoList.push(itemData);

        console.log("Host list: " + JSON.stringify(hostTodoList));
    }
    
    const removeFromHostList = (item, owner) => {
        
        var filtered = hostTodoList.filter(function(element){
            console.log("Item: " + element.item + " owner: " + element.owner);
            
            let isMatch = element.item == item && element.owner == owner;
            
            return !isMatch;
        });
        
        hostTodoList = filtered;
        console.log("Filtered: " + JSON.stringify(hostTodoList));        
    }

    // Prompt for setting a username
    let username;
    let connected = false;
    let typing = false;
    let lastTypingTime;
    let $currentInput = $usernameInput.focus();

    // Sets the client's username
    const setUsername = () => {
        username = cleanInput($usernameInput.val().trim());

        // If the username is valid
        if (username) {
            $loginPage.fadeOut();
            $todoPage.show();
            $loginPage.off('click');
            $currentInput = $inputMessage.focus();

            // Tell the server your username
            socket.emit('add user', username);

            if (username == "pzyu") {
                isHost = true;
                console.log("Host connected");
            } else {
                // Request for host list
                socket.emit('request for list', socket.id);
            }
        }
    }

    const cleanInput = (input) => {
        return $('<div/>').text(input).html();
    }

    // Keyboard events

    $window.keydown(event => {
        // Auto-focus the current input when a key is typed
        if (!(event.ctrlKey || event.metaKey || event.altKey)) {
            $currentInput.focus();
        }
        // When the client hits ENTER on their keyboard
        if (event.which === 13) {
            if (username) {
                $addItemForm.submit();

            } else {
                setUsername();
            }
        }
    });

    $inputMessage.on('input', () => {
        updateTyping();
    });

    // Click events

    // Focus input when clicking anywhere on login page
    $loginPage.click(() => {
        $currentInput.focus();
    });

    // Focus input when clicking on the message input's border
    $inputMessage.click(() => {
        $inputMessage.focus();
    });

    // Socket events

    socket.on('new item', (data) => {
        if (!username) {
            return;
        }
        
        console.log(`New item ${data.item}, owner ${data.owner}`);

        addNewItem(data.item, data.owner);
    });

    socket.on('remove item', (data) => {
        if (!username) {
            return;
        }
        
        console.log("Removing item: " + JSON.stringify(data));

        $todoListContainer.children().filter(function () {
            if ($(this).data("item") == data.item && $(this).data("owner") == data.owner) {
                console.log("Found match");

                $(this).fadeOut("normal", function () {
                    $(this.remove());
                });
                
                if (isHost) {
                    removeFromHostList(data.item, data.owner);
                }
            }
        });
    });
    
    
    socket.on('request for list', (data) => {
        if (!username) {
            return;
        }
        
        if (isHost) {
            console.log(`Request received from ${data}`);
            
            let response = {
                requestorId: data,
                list: hostTodoList
            }            
            socket.emit('response for list', response);
        }    
    });
    
    // Request has been responded with
    socket.on('response for list', (data) => {
        if (!username) {
            return;
        }
        
        console.log("Received response: " + JSON.stringify(data));
        
        data.forEach((item) => {
           addNewItem(item.item, item.owner); 
        });
    });

    socket.on("connect", () => {
        console.log(socket.connected); // true
    });

    socket.on('disconnect', () => {});

    socket.on('reconnect', () => {
        if (username) {
            socket.emit('add user', username);
        }
    });

    socket.on('reconnect_error', () => {});
});
