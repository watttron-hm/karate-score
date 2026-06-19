const socket = io()

function createInitialState(){
    return {
        aka:{
            name: "",
            club: "",
            flag: "",
            ippon:0,
            waza:0,
            penalties:[0,0,0]
        },
        shiro:{
            name: "",
            club: "",
            flag: "",
            ippon:0,
            waza:0,
            penalties:[0,0,0]
        },
        match: {
            fightNumber: "",
            category: "",
            nextFight: ""
        },
        timer: {
            totalTimeInS: 120,
            currentTimeInS: 120,
            status: "stopped"
        }
    };
}

let state = createInitialState();

let timerInterval = null;
let undoStack = [];
let redoStack = [];
let pendingPenaltyFeedback = null;

function cloneState(scoreState){
    return JSON.parse(JSON.stringify(scoreState));
}

function rememberState(){
    undoStack.push(cloneState(state));
    redoStack = [];
    updateUndoRedoButtons();
}

function restoreState(scoreState){
    clearInterval(timerInterval);
    timerInterval = null;
    state = cloneState(scoreState);
    renderScore(state)
    renderMatchInfo(state)
    publishScoreState();
    updateUndoRedoButtons();
}

function undoLastAction(){
    if(undoStack.length === 0) return;

    redoStack.push(cloneState(state));
    restoreState(undoStack.pop());
}

function redoLastAction(){
    if(redoStack.length === 0) return;

    undoStack.push(cloneState(state));
    restoreState(redoStack.pop());
}

function updateUndoRedoButtons(){
    const undoButton = document.getElementById("undoButton");
    const redoButton = document.getElementById("redoButton");

    if(undoButton){
        undoButton.disabled = undoStack.length === 0;
    }
    if(redoButton){
        redoButton.disabled = redoStack.length === 0;
    }
}

function showClickFeedback(element){
    if(!element) return;

    element.classList.remove("click-feedback");
    void element.offsetWidth;
    element.classList.add("click-feedback");

    window.setTimeout(() => {
        element.classList.remove("click-feedback");
    }, 1000);
}

function setupDisplayClickFeedback(){
    const displayArea = document.getElementById("displayArea");
    if(!displayArea) return;

    displayArea.addEventListener("click", event => {
        const target = event.target.closest("button, .inline-info-input");
        if(!target || !displayArea.contains(target)) return;

        showClickFeedback(target);
    });
}

function renderPenalties(side) {
    const isOperatorView = Boolean(document.querySelector(".operator-layout"));

    for(let i=0;i<3;i++){

        const container = document.getElementById(side+"Penalty"+i);
        if(!container) continue;

        container.innerHTML = "";

        for(let j=0;j<4;j++){
            if(!isOperatorView && j == 0){
                continue
            }

            const dot = document.createElement("div");
            dot.classList.add("dot");

            if(j === 0){
                dot.classList.add("clear-dot");
                dot.title = "Strafen entfernen";
            }else if(j <= state[side].penalties[i]){
                dot.classList.add("active");
            }

            if(
                pendingPenaltyFeedback &&
                pendingPenaltyFeedback.side === side &&
                pendingPenaltyFeedback.index === i &&
                pendingPenaltyFeedback.value === j
            ){
                window.setTimeout(() => showClickFeedback(dot), 0);
                pendingPenaltyFeedback = null;
            }

            if(isOperatorView){
                dot.classList.add("clickable-dot");
                dot.setAttribute("role", "button");
                dot.setAttribute("tabindex", "0");
                dot.addEventListener("click", () => setPenalty(side, i, j));
                dot.addEventListener("keydown", event => {
                    if(event.key === "Enter" || event.key === " "){
                        event.preventDefault();
                        setPenalty(side, i, j);
                    }
                });
            }

            container.appendChild(dot);
        }
    }
}

function changeScore(side,type,delta){

    rememberState();
    state[side][type] += delta;

    if(state[side][type] < 0){
        state[side][type] = 0;
    }

    renderScore(state);
    publishScoreState();
}

function renderScore(scoreState){
    if(typeof scoreState === "string"){
        scoreState = JSON.parse(scoreState);
    }

    state = scoreState;

    ["aka", "shiro"].forEach(side => {
        const defaultName = side === "aka" ? "AKA" : "SHIRO";
        const defaultFlag = side === "aka" ? "🇩🇪" : "🇯🇵";
        const nameDisplay = document.getElementById(side + "NameDisplay");
        if(nameDisplay){
            nameDisplay.innerText = state[side].name || defaultName;
        }

        const clubDisplay = document.getElementById(side + "ClubDisplay");
        if(clubDisplay){
            clubDisplay.innerText = state[side].club || "Verein";
        }

        const flagDisplay = document.getElementById(side + "FlagDisplay");
        if(flagDisplay){
            flagDisplay.innerText = state[side].flag || defaultFlag;
        }

        ["ippon", "waza"].forEach(type => {
            const scoreDisplay = document.getElementById(side + capitalize(type));
            if(scoreDisplay){
                scoreDisplay.innerText = state[side][type];
            }
        });

        renderPenalties(side);
        renderMatchInfo(state)
        updateTimerDisplay()
    });
}

function renderMatchInfo(scoreState) {
    if(typeof scoreState === "string"){
        scoreState = JSON.parse(scoreState);
    }

    state = scoreState;

    if(state.match){
        // setElementValue("fightNumber", state.match.fightNumber)
        setElementValue("fightDisplay", state.match.fightNumber)
        // setElementValue("category", state.match.category)
        setElementValue("categoryDisplay", state.match.category)
        // setElementValue("nextFight", state.match.nextFight)
        setElementValue("nextFightDisplay", state.match.nextFight)
    }
}

function publishScoreState(){
    fetch("/update_score", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        credentials: "same-origin",
        body: JSON.stringify(state)
    }).then(response => {
        if(response.status !== 200){
            showLoginRequiredMessage();
        }
    }).catch(error => {
        console.error("Failed to publish score state", error);
    });
}

function showLoginRequiredMessage(){
    if(document.getElementById("loginRequiredMessage")) return;

    const message = document.createElement("div");
    message.id = "loginRequiredMessage";
    message.className = "login-required-message";
    message.innerHTML = 'Du musst eingeloggt sein, um den Score zu ändern. <a href="/login">Zum Login</a>';

    document.body.appendChild(message);
}

function changePenalty(side,index,delta){

    rememberState();
    state[side].penalties[index] += delta;

    if(state[side].penalties[index] < 0){
        state[side].penalties[index] = 0;
    }

    if(state[side].penalties[index] > 3){
        state[side].penalties[index] = 3;
    }

    publishScoreState();
    renderPenalties(side);
}

function setPenalty(side,index,value){
    rememberState();
    state[side].penalties[index] = value;
    pendingPenaltyFeedback = { side, index, value };
    renderPenalties(side);
    publishScoreState();
}

socket.on("scoreboard", renderScore);

function capitalize(s){
    return s.charAt(0).toUpperCase() + s.slice(1);
}

function setElementValue(id,value){
    const element = document.getElementById(id);
    if(!element) return;

    if("value" in element){
        element.value = value || "";
    }else{
        element.innerText = value || "-";
    }
}

function updateFighters(){
    if(!document.getElementById("akaName")) return;

    state.aka.name = document.getElementById("akaName").value || "AKA";
    state.aka.club = document.getElementById("akaClub").value || "Verein";
    state.aka.flag = document.getElementById("akaFlag").value || state.aka.flag;
    state.shiro.name = document.getElementById("shiroName").value || "SHIRO";
    state.shiro.club = document.getElementById("shiroClub").value || "Verein";
    state.shiro.flag = document.getElementById("shiroFlag").value || state.shiro.flag;

    renderScore(state)
}

function updateMatchInfo(){
    if(!document.getElementById("fightNumber")) return;
    console.log("update match info")

    state.match.fightNumber = document.getElementById("fightNumber").value || "-";
    console.log("fight no", state.match.fightNumber)
    state.match.category = document.getElementById("category").value || "-";
    state.match.nextFight = document.getElementById("nextFight").value || "-";

    renderScore(state)
}

document.querySelectorAll("input").forEach(e=>{
    e.addEventListener("blur",()=>{
        rememberState();
        updateFighters();
        updateMatchInfo();
        publishScoreState()
    });
});

function updateTimerDisplay(){
    const timerDisplay = document.getElementById("timerDisplay");
    if(!timerDisplay) return;

    updateFightTimeDisplay();

    let min = Math.floor(state.timer.currentTimeInS / 60);
    let sec = state.timer.currentTimeInS % 60;

    min = String(min).padStart(2,"0");
    sec = String(sec).padStart(2,"0");

    timerDisplay.innerText = `${min}:${sec}`;
    if(state.timer.status == "started" && !timerInterval) {
        timerInterval = setInterval(() => {
            if(state.timer.currentTimeInS > 0) {
                state.timer.currentTimeInS--
                updateTimerDisplay()
            } else {
                clearInterval(timerInterval)
                timerInterval = null
            }
        }, 1000)
    } else if (["paused", "stopped"].includes(state.timer.status) && timerInterval) {
        clearInterval(timerInterval)
        timerInterval = null
    }
}

function updateFightTimeDisplay(){
    const fightTimeDisplay = document.getElementById("fightTimeDisplay");
    if(!fightTimeDisplay) return;

    let min = Math.floor(state.timer.totalTimeInS / 60);
    let sec = state.timer.totalTimeInS % 60;

    min = String(min).padStart(2,"0");
    sec = String(sec).padStart(2,"0");

    fightTimeDisplay.innerText = `${min} min : ${sec} sec`;
}

function startTimer(){
    if(timerInterval) return;
    rememberState();
    state.timer.status = "started";
    publishScoreState();

    timerInterval = setInterval(()=>{

        if(state.timer.currentTimeInS > 0){
            state.timer.currentTimeInS--;
            updateTimerDisplay();
        } else{
            clearInterval(timerInterval);
            timerInterval = null;
            state.timer.status = "stopped"
            publishScoreState()
        }
    },1000);
}

function pauseTimer(){
    rememberState();
    clearInterval(timerInterval);
    timerInterval = null;
    state.timer.status = "paused"
    publishScoreState();
}

function resetTimer(shouldPublish = true) {
    if(shouldPublish){
        rememberState();
    }

    clearInterval(timerInterval);
    timerInterval = null;

    const minutesInput = document.getElementById("minutes");
    const secondsInput = document.getElementById("seconds");
    if(!minutesInput || !secondsInput){
        state.timer.status = "stopped"
        updateFightTimeDisplay();
        updateTimerDisplay();
        if(shouldPublish){
            publishScoreState();
        }
        return;
    }

    const min =
        parseInt(minutesInput.value) || 0;

    const sec =
        parseInt(secondsInput.value) || 0;

    state.timer.totalTimeInS = min * 60 + sec
    state.timer.currentTimeInS = state.timer.totalTimeInS
    state.timer.status = "stopped"

    updateFightTimeDisplay();
    updateTimerDisplay();
    if(shouldPublish){
        publishScoreState();
    }
}

function resetAll(){
    const confirmed = window.confirm("Aktuellen Score wirklich vollständig zurücksetzen?");
    if(!confirmed) return;

    rememberState();
    clearInterval(timerInterval);
    timerInterval = null;
    state = createInitialState();

    ["akaName", "akaClub", "akaFlag", "shiroName", "shiroClub", "shiroFlag", "fightNumber", "category", "nextFight"].forEach(id => {
        const input = document.getElementById(id);
        if(input){
            input.value = "";
        }
    });

    const minutesInput = document.getElementById("minutes");
    const secondsInput = document.getElementById("seconds");
    if(minutesInput){
        minutesInput.value = 2;
    }
    if(secondsInput){
        secondsInput.value = 0;
    }

    renderScore(state);
    publishScoreState();
}

renderPenalties("aka");
renderPenalties("shiro");
resetTimer(false);
setupDisplayClickFeedback();

if(window.scoreboardInitialState){
    renderScore(window.scoreboardInitialState);
    renderMatchInfo(window.scoreboardInitialState);
}

updateUndoRedoButtons();
