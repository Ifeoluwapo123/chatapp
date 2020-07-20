const socket = io('/');
const input = document.getElementById('chat');
const messages = document.getElementById('messages');
const name = document.getElementById('name').innerText;

function clearchat(){
	localStorage.clear();
	document.location.href = "/nodecomunity";
}

if(localStorage.hasOwnProperty('res')===true){
	count = localStorage.getItem('res');
}else{
	localStorage.setItem('res', 0);
	count = localStorage.getItem('res');
}

append('You joined');

socket.emit('user',name);

socket.on('user-connected', (name)=>{
	append(`${name} connected`);
})

socket.on('broadcast messages to client', (data)=>{
	console.log(data);
	send(`${data.name}: ${data.message}`);
});

input.addEventListener('keypress', event =>{
	if(event.keyCode == 13){
		let message = event.target.value;
		socket.emit('message from client',message);
		event.target.value = " ";
	}
});

function send(message){
	result = localStorage.getItem('res');
	result++;
	localStorage.setItem('chat'+result, message);
	let data = localStorage.getItem('chat'+result);
	let p = document.createElement('p');
	p.innerText = data;
	messages.appendChild(p);
	count++;
	localStorage.setItem('res', count);
}

function append(message){
	let p = document.createElement('small');
	let b = document.createElement('br');
	p.innerText = message;
	messages.appendChild(p);
	messages.appendChild(b);
}

function loadSaveChats(){
	if(localStorage.hasOwnProperty('res') === true){
		let num = localStorage.getItem('res');
		for(var i = 1; i < parseInt(num)+1; i++){
			let val = localStorage.getItem('chat'+i);
			let p = document.createElement('p');
			p.innerText = val;
			messages.appendChild(p);
		}
	}
}

loadSaveChats();

//$('#messages').animate({scrollTop: $(document).height()}, 'fast');
messages.scrollTop = messages.scrollHeight;


