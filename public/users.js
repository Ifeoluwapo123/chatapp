const socket = io('/');
const input = document.getElementById('chat');
const send = document.getElementById('sender').innerText;
const messages = document.getElementById('messages');
const receive = document.getElementById('receiver').innerText;

let sender = send+"%"+receive;

input.addEventListener('keypress', event =>{
	if(event.keyCode == 13){
		let message = event.target.value;
		var time;
	    var date = Date.now();
	    var x = new Date();
	    var minute = x.getMinutes();

	    if(x.getHours() >= 12){
	    	time = x.getHours()-12+":"+minute+"PM";
	    }else{
	    	time = x.getHours()+":"+minute+"AM";
	    }

		socket.emit('sender',{
			mess:message, 
			sender:sender,  
			timetracker: date,
			time:time
		});
		event.target.value = " ";
		postmessage(message);
	}
});

function postmessage(message){
	let p = document.createElement('p');
	p.style.cssText = 'margin-left: 106px; background-color: #fff432';
	p.innerText = message;
	messages.appendChild(p);
}

messages.scrollTop = messages.scrollHeight;