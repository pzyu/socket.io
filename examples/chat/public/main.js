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

    const $pages = $('.page'); // The page
    const $loginPage = $('.login.page'); // The login page
    const $chatPage = $('.chat.page'); // The chatroom page
    const $todoPage = $('.todo.page'); // The chatroom page

    const $addItemForm = $("#add-item-form");
    const $addItemInput = $("#add-item-input");
    const $addItemNameInput = $("#add-item-name-input");

    const $todoListContainer = $("#todo-list-container");
    const $todoCompletedListContainer = $("#todo-list-completed-container");
    const $todoNotDoingListContainer = $("#todo-list-not-doing-container");

    // Queue number
    const $queueNumberContainer = $("#queue-number-container");
    const $queueLabel = $("#queue-label");
    const $queueNumber = $("#queue-number");

    let isHost = false;
    let itemList = [];
    let queueNumber = -1;

    const socket = io();
    console.log = function() {};

    // Handle adding items    
    $addItemForm.submit(function (e) {
        e.preventDefault();

        // Get all the forms elements and their values in one step
        var values = $(this).serializeArray();

        var item = $("input[name='item']", this).val();
        var owner = $("input[name='owner']", this).val();

        console.log("Item: " + item + " owner: " + owner);

        $addItemInput.val("");

        let itemData = {
            item: item,
            owner: owner
        }

        socket.emit('new item', itemData);
    });

    const addNewItem = (item, owner, targetContainer) => {
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
        const $inProgressButton = $('<button class="btn btn-primary mx-2">In progress</button>')
            .click(function () {
                updateItemStatus($(this), "in progress");
            });
        const $completeButton = $('<button class="btn btn-success mx-2">Complete</button>')
            .click(function () {
                updateItemStatus($(this), "complete");
            });
        const $deleteButton = $('<button class="btn btn-danger mx-2">Not doing</button>')
            .click(function () {
                updateItemStatus($(this), "not doing");
            });
        const $removeButton = $('<button class="btn btn-light mx-2">X</button>')
            .click(function () {
                updateItemStatus($(this), "remove");
            });

        $controlsDiv.append($inProgressButton, $completeButton, $deleteButton, $removeButton);

        const $itemDiv = $('<li class="list-group-item"/>')
            .data('owner', owner)
            .data('item', item)
            .append($itemDescriptionLabel, $itemOwnerLabel);

        addNewItemElement($itemDiv, targetContainer);


        // If we are host
        if (isHost) {
            // Add controls
            $itemDiv.append($controlsDiv);

            // Build item list
            buildItemList();
        }


        // If we have moved something, check queue
        checkQueueNumber();
    }

    const buildItemList = () => {
        itemList = [];

        $todoListContainer.children().each(function (index) {
            let itemData = {
                name: $(this).data("item"),
                owner: $(this).data("owner"),
                status: "in progress",
            }

            itemList.push(itemData);
        });

        $todoCompletedListContainer.children().each(function (index) {
            let itemData = {
                name: $(this).data("item"),
                owner: $(this).data("owner"),
                status: "completed",
            }

            itemList.push(itemData);
        });


        $todoNotDoingListContainer.children().each(function (index) {
            let itemData = {
                name: $(this).data("item"),
                owner: $(this).data("owner"),
                status: "not doing",
            }

            itemList.push(itemData);
        });


        console.log("Item list: " + JSON.stringify(itemList));
    }

    const updateItemStatus = (el, status) => {
        let parentDiv = el.closest(".list-group-item")

        let item = parentDiv.data("item");
        let owner = parentDiv.data("owner");

        let itemData = {
            item: item,
            owner: owner,
            status: status
        }

        socket.emit('update item', itemData);
    }

    const addNewItemElement = (el, targetContainer) => {
        const $el = $(el);
        $el.hide().fadeIn("fast");
        targetContainer.append($el);
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

            $addItemNameInput.val(username);
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

        addNewItem(data.item, data.owner, $todoListContainer);
    });

    socket.on('update item', (data) => {
        if (!username) {
            return;
        }

        console.log("Updating item: " + JSON.stringify(data));

        let $targetContainer = $todoCompletedListContainer;

        switch (data.status) {
            case "in progress":
                $targetContainer = $todoListContainer;
                break;
            case "not doing":
                $targetContainer = $todoNotDoingListContainer;
                break;
            case "remove":
                $targetContainer = null;
                break;
        }

        $todoListContainer.children().filter(function () {
            findAndMove($(this), $targetContainer, data);
            return;
        });
        $todoCompletedListContainer.children().filter(function () {
            findAndMove($(this), $targetContainer, data);
            return;
        });
        $todoNotDoingListContainer.children().filter(function () {
            findAndMove($(this), $targetContainer, data);
            return;
        });
    });

    const findAndMove = (el, target, data) => {
        console.log("Item: " + $(el).data("item"));

        if ($(el).data("item") == data.item && $(el).data("owner") == data.owner) {
            $(el).fadeOut("fast", function () {
                $(el).detach().appendTo(target);
                $(el).fadeIn("fast");

                if (isHost) {
                    // Build item list again if we have moved
                    buildItemList();
                }

                // If we have moved something, check queue
                checkQueueNumber();
            });
        }
    }

    const checkQueueNumber = () => {
        let hasItemInQueue = false;
        let newQueueNumber = -1;
        
        // Go through in progress list
        $todoListContainer.children().each(function (index) {

            if ($(this).data("owner") == username && !hasItemInQueue) {
                console.log("My next item is: " + index);

                newQueueNumber = index + 1;
                $queueNumber.text(newQueueNumber);

                hasItemInQueue = true;

                return;
            }
        });

        // Check if has item in queue
        if (hasItemInQueue) {
            $($queueNumberContainer).fadeIn("fast");
        } else {
            $($queueNumberContainer).fadeOut("fast");
        }
        
        console.log("New: "+ newQueueNumber + " queue: " + queueNumber);

        // So we don't play effects repeatedly
        if (newQueueNumber != queueNumber) {
            queueNumber = newQueueNumber;            

            $queueLabel.removeClass("shake-little");
            $queueLabel.removeClass("shake");
            $queueLabel.removeClass("shake-hard");
            $queueLabel.removeClass("shake-crazy");
            
            if (queueNumber == 4) {
                $queueLabel.addClass("shake-little");
            } else if (queueNumber == 3) {
                $queueLabel.addClass("shake");
            } else if (queueNumber == 2) {
                $queueLabel.addClass("shake-hard");
            } else if (queueNumber == 1) {
                $queueLabel.addClass("shake-crazy");
                showEffects();
            }
        }
    }


    const showEffects = () => {
        var end = Date.now() + (3 * 1000);

        var colors = ['#FFD700', '#ffffff'];

        (function frame() {
            confetti({
                particleCount: 2,
                angle: 60,
                spread: 55,
                origin: {
                    x: 0
                },
                colors: colors
            });
            confetti({
                particleCount: 2,
                angle: 120,
                spread: 55,
                origin: {
                    x: 1
                },
                colors: colors
            });

            if (Date.now() < end) {
                requestAnimationFrame(frame);
            }
        }());
        
        var audioElement = new Audio('horn.wav');
        audioElement.play();
        
        $pages.addClass("animate-background");
    }

    socket.on('request for list', (data) => {
        if (!username) {
            return;
        }

        if (isHost) {
            console.log(`Request received from ${data}`);

            let response = {
                requestorId: data,
                list: itemList
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
            let targetContainer = null;

            switch (item.status) {
                case "in progress":
                    targetContainer = $todoListContainer;
                    break;
                case "completed":
                    targetContainer = $todoCompletedListContainer;
                    break;
                case "not doing":
                    targetContainer = $todoNotDoingListContainer;
                    break;
            }

            addNewItem(item.name, item.owner, targetContainer);
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
