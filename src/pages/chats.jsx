import { useNavigate, useParams } from "react-router-dom";
import { useContext, useEffect, useRef } from "react";
import { AuthContext } from "../context/authContext";
import {
  getDoc,
  setDoc,
  doc,
  updateDoc,
  serverTimestamp,
  arrayUnion,
  onSnapshot,
  collection,
  getDocs
} from "firebase/firestore";
import {
  getStorage,
  ref,
  uploadBytesResumable,
  getDownloadURL,
} from "firebase/storage";
import { db } from "../firebase";
import { signOut } from "firebase/auth";
import { auth } from "../firebase";
import { useState } from "react";
import { toast, ToastContainer } from "react-toastify";
import EmojiPicker from "emoji-picker-react";

const Chats = (props) => {
  const navigate = useNavigate();
  const id = useParams()
  const {signInTime} = props
  
  const { currentUser } = useContext(AuthContext);
  const [searchName, setSearchName] = useState();
  const [resultSearchUser, setResultSearchUser] = useState();
  const [selectedUser, setSelectedUser] = useState();
  const [emojiStatus, setEmojiStatus] = useState(false);
  const [message, setMessage] = useState("");
  const [messageStatus, setMessageStatus] = useState()
  const [mergedId, setMergedID] = useState("");
  const [users, setUsers] = useState([]);
  const [allMessages, setAllMessages] = useState([]);
  const [showChat, setShowChat] = useState(false)
  const [file, setFile] = useState();

  const lastMessageTime = useRef(signInTime);

  useEffect(() => {
    return () => getUsers();
  }, []);
  
  function logOut() {
    signOut(auth);
    navigate("/", { replace: true });
  }

  function getFile(e){
    setFile(e.currentTarget.files[0])
    setMessageStatus("file")
  }

  async function searchHandle() {
    const querySnapshot = await getDocs(collection(db, "users"));
querySnapshot.forEach((doc) => {
  if(doc.data().displayName === searchName){
    setResultSearchUser(doc.data())
  }
});
  }
  
  function getUsers() {
    try{
      onSnapshot(doc(db, "userChats", id.id), (doc)=>{
        const object1 = doc.data()
        let chatUsers = Object.keys(object1).map(function (el){
          var newObj = {}
          newObj["userInfo"] = {...object1[el]["userInfo"], ...{mergedId : el}}
          newObj["lastMessage"] = object1[el]["lastMessage"]
          return  newObj
        })
        setUsers(chatUsers)
        let getNewUserMessage = chatUsers.filter(el => el?.lastMessage?.secTime - lastMessageTime.current > 0)[0]?.lastMessage
        if(getNewUserMessage?.from !== currentUser.displayName && getNewUserMessage?.from !== undefined){
          toast(`${getNewUserMessage?.from} :- ${getNewUserMessage?.msg}`)
          let audio = new Audio("/images/mixkit-bell-notification-933.wav")
          audio.play()
          lastMessageTime.current = Date.now()
        }
      })
    }catch{
      toast.error("SomeThing Error")
    }
  }


  async function selectUserChat(user) {
    let mergeID;
    if(user?.uid !== undefined){
      mergeID = currentUser.uid > user.uid ? currentUser.uid + user.uid :  user.uid + currentUser.uid 
    }else{
      mergeID = currentUser.uid > user.userInfo.uid ? currentUser.uid + user.userInfo.uid :  user.userInfo.uid + currentUser.uid 
    }
    setShowChat(true)
    try {
      const res = await getDoc(doc(db, "chats", mergeID));
      if (!res.exists()) {
        await setDoc(doc(db, "chats", mergeID), { messages: [] });

        await updateDoc(doc(db, "userChats", currentUser.uid), {
          [mergeID + ".userInfo"]: {
            uid: user.uid,
            displayName: user.displayName,
            photoURL: user.photoURL,
          },
          [mergeID + ".date"]: serverTimestamp(),
        });

        await updateDoc(doc(db, "userChats", user.uid), {
          [mergeID + ".userInfo"]: {
            uid: currentUser.uid,
            displayName: currentUser.displayName,
            photoURL: currentUser.photoURL,
          },
          [mergeID + ".date"]: serverTimestamp(),
        });
      }
    } catch {
      toast.error("Something Error");
    }
    setResultSearchUser(null);
    setMergedID(mergeID)
    if(user.uid){
      setSelectedUser({ name: user.displayName, photo: user.photoURL, id: user.uid });
    }else{
      setSelectedUser({ name: user.userInfo.displayName, photo: user.userInfo.photoURL, id: user.userInfo.uid });
    }
    onSnapshot(doc(db, "chats", mergeID), (doc) => {
      setAllMessages(doc.data().messages);
    });
  }

  async function sendMessage() {
    let time = parseInt(new Date().toString().slice(16, 18));
    if (time > 12) {
      time = `${time - 12}:${new Date().toString().slice(19, 21)}PM`;
    } else {
      time = `${new Date().toString().slice(16, 21)}AM`;
    }
    if (message) {
      await updateDoc(doc(db, "chats", mergedId), {
        messages: arrayUnion({
          from : currentUser.displayName,
          to : selectedUser.name,
          message: message,
          msgTime: time,
        }),
      });
      await updateDoc(doc(db,"userChats",currentUser.uid),{
        [mergedId + ".lastMessage"]: {
          msg : message,
          msgTime : time,
          secTime : Date.now(),
          from : currentUser.displayName,
          to : selectedUser.name
        }
      })
      await updateDoc(doc(db,"userChats",selectedUser.id),{
        [mergedId + ".lastMessage"]: {
          msg : message,
          msgTime : time,
          secTime : Date.now(),
          from : currentUser.displayName,
          to : currentUser.displayName
        }
      })
    setMessage("");
    }
    if (file)
    {
      const storage = getStorage();
      const storageRef = ref(storage, `chat-images/${file.lastModified}`);
      const uploadTask = uploadBytesResumable(storageRef, file);
      uploadTask.on(
        "state_changed",
        (snapshot) => {
          const progress =
            (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          toast("Upload is " + progress + "% done");
        },
        () => {
          toast.error("Something wrong");
        },
        () => {
          getDownloadURL(uploadTask.snapshot.ref).then(async (downloadURL) => {
            await updateDoc(doc(db, "chats", mergedId), {
              messages: arrayUnion({
                from : currentUser.displayName,
                to : selectedUser.name,
                path: downloadURL,
                msgTime: time,
                type: file.type.split("/")[0],
              }),
            });
          });
        }
      );
      await updateDoc(doc(db,"userChats",currentUser.uid),{
        [mergedId + ".lastMessage"]: {
          msg : file.name,
          msgTime : time,
          secTime : Date.now(),
          from : currentUser.displayName,
          to : selectedUser.name
        }
      })
      await updateDoc(doc(db,"userChats",selectedUser.id),{
        [mergedId + ".lastMessage"]: {
          msg : file.name,
          msgTime : time,
          secTime : Date.now(),
          from : currentUser.displayName,
          to : selectedUser.name
        }
      })
    }
    setMessageStatus(null)
    setFile(null)

}

  return (
    <>
      <div className="main m-auto xl:w-3/4  h-[80vh] flex my-10  border-gray-200 border-2">
        <div className={`${showChat ? "hidden" : "block"} md:block left pt-5 w-full md:max-w-[40%] pt-10`}>
          <div className="px-5">
            <div className="person flex justify-between items-center">
              <div className="flex items-center w-72">
                <img
                  className="w-16 rounded-full border-gray-200 border-2"
                  src={currentUser?.photoURL}
                  alt="preson"
                />
                <h1 className="ml-5 text-lg	 font-bold">
                  {currentUser?.displayName}
                </h1>
              </div>
              <button
                onClick={logOut}
                className="ml-1.5 font-bold text-xs lg:text-base rounded w-24 h-9 px-3 text-white  bg-sky-500 active:bg-cyan-950 duration-100"
              >
                Log Out
              </button>
            </div>
            <div className="search mt-3">
              <input
                onChange={(e) => setSearchName(e.currentTarget.value)}
                className="w-[calc(100%-48px)] pl-2 rounded h-9 bg-gray-300"
                placeholder="Search name"
                type="text"
                name="search"
                id="search"
              />
              <button
                onClick={searchHandle}
                className="ml-1.5 rounded h-9 px-3 text-white  bg-sky-500 active:bg-cyan-950 duration-100"
              >
                <i className="fa-solid  fa-magnifying-glass"></i>
              </button>
            </div>
          </div>
          <div className="chats max-h-[calc(100%-130px)] overflow-y-auto">
            {resultSearchUser ? (
                              <div
                              className="duration-200  group cursor-pointer	 mt-5 hover:bg-[#44cfcb]  p-3 border-b-gray-200 border-b-2"
                              onClick={() => selectUserChat(resultSearchUser)}
                            >
                                        <div className="absolute text-2xl cursor-pointer md:hidden right-[20px] top-[20px]" onClick={() => setShowChat(false)}>
            <i className="fa-solid fa-xmark"></i>
            </div>
                              <div className=" flex group-py-2 w-[80%]">
                                <div className="min-w-[20%] mr-4">
                                  <img
                                    className="m-auto rounded-full"
                                    src={resultSearchUser.photoURL}
                                    alt="sun"
                                  />
                                </div>
                                <div className="max-w-[80%]">
                                  <h3 className="font-bold group-hover:text-white">
                                    {resultSearchUser.displayName}
                                  </h3>
                                </div>
                              </div>
                            </div>
            ):(
              users
                .map((user) => (
                  <div
                    className="duration-200 group cursor-pointer	 mt-5 hover:bg-[#44cfcb]  p-3 border-b-gray-200 border-b-2"
                    onClick={() => selectUserChat(user)}
                    key={user.userInfo.uid}
                  >
                    <div className=" flex group-py-2 w-[80%]">
                      <div className="min-w-[20%] mr-4">
                        <img
                          className="m-auto rounded-full"
                          src={user.userInfo.photoURL}
                          alt="sun"
                        />
                      </div>
                      <div className="max-w-[80%]">
                        <h3 className="font-bold group-hover:text-white">
                          {user.userInfo.displayName}
                        </h3>
                        <div className="flex  justify-between my-3">
                          <p className="text-ellipsis whitespace-nowrap group-hover:text-white overflow-hidden w-full text-slate-400	">
                          {user.lastMessage?.msg}
                          
                          </p>
                          <p className="text-slate-400	group-hover:text-white">
                          {user.lastMessage?.msgTime}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
            )}

          </div>
        </div>

        <div className={`right ${showChat ?  "block" : "hidden" } md:block w-full md-w-[60%]  border-l-gray-200 border-l-2 relative`}>
        {selectedUser ? (
          <>
          <div className="head relative h-[100px] flex items-center w-full bg-gray-200 p-3">
            <img className="rounded-full" src={selectedUser?.photo} alt="" />
            <h1 className="ml-3 text-2xl font-bold">{selectedUser?.name}</h1>
            <div className="absolute text-2xl cursor-pointer md:hidden right-[20px] top-[20px]" onClick={() => setShowChat(false)}>
            <i className="fa-solid fa-xmark"></i>
            </div>
          </div>
          <div className="messages w-full grid bg-gray-100 overflow-y-auto max-h-[calc(100%-150px)]">
            {allMessages.map((mes) =>
              mes.from === currentUser.displayName ? (
                <>
                  {mes.message? (
                    <div key={mes.msgTime} className="message w-80 bg-[#1c3738] p-3 items-end flex text-white ml-3 my-1.5 relative rounded before:content-[''] before:absolute before:top-[50%] before:left-[-3px] before:bg-[#1c3738] before:w-2 before:h-2 before:rotate-[72deg] before:skew-y-[319deg]">
                      <p className="w-[calc(100%-70px)]">{mes.message}</p>
                      <span>{mes.msgTime}</span>
                    </div>
                  ) : mes.type === "image" ? (
                    <div key={mes.msgTime} className="message w-80 bg-[#1c3738] p-3 items-end flex text-white ml-3 my-1.5 relative rounded before:content-[''] before:absolute before:top-[50%] before:left-[-3px] before:bg-[#1c3738] before:w-2 before:h-2 before:rotate-[72deg] before:skew-y-[319deg]">
                      <img className="w-4/5" src={mes.path} alt="img" />
                      <span>{mes.msgTime}</span>
                    </div>
                  ) : (
                    <div key={mes.msgTime} className="message w-80 bg-[#1c3738] p-3 items-end flex text-white ml-3 my-1.5 relative rounded before:content-[''] before:absolute before:top-[50%] before:left-[-3px] before:bg-[#1c3738] before:w-2 before:h-2 before:rotate-[72deg] before:skew-y-[319deg]">
                      <audio controls>
                        <source src={mes.path} />
                      </audio>
                      <span>{mes.msgTime}</span>
                    </div>
                  )}
                </>
              ) : (
                <>
                {mes.message ? (
                <div key={mes.msgTime} className="message w-80 bg-[#44cfcb] relative items-end right-0 p-3 justify-self-end flex text-white mr-3 my-1.5 rounded before:content-[''] before:absolute before:top-[50%] before:right-[-3px] before:bg-[#44cfcb] before:w-2 before:h-2 before:rotate-[72deg] before:skew-y-[319deg]">
                <p className="w-[calc(100%-70px)]">{mes.message}</p>
                <span>{mes.time}</span>
              </div>
                  ) : mes.type === "image" ? (
                    <div key={mes.msgTime} className="message w-80 bg-[#44cfcb] relative items-end right-0 p-3 justify-self-end flex text-white mr-3 my-1.5 rounded before:content-[''] before:absolute before:top-[50%] before:right-[-3px] before:bg-[#44cfcb] before:w-2 before:h-2 before:rotate-[72deg] before:skew-y-[319deg]">
                <img className="w-4/5" src={mes.path} alt="img" />
                      <span>{mes.msgTime}</span>
              </div>
                  ) : (
                    <div key={mes.msgTime} className="message w-80 bg-[#44cfcb] relative items-end right-0 p-3 justify-self-end flex text-white mr-3 my-1.5 rounded before:content-[''] before:absolute before:top-[50%] before:right-[-3px] before:bg-[#44cfcb] before:w-2 before:h-2 before:rotate-[72deg] before:skew-y-[319deg]">
                                         <audio controls>
                        <source src={mes.path} />
                      </audio>
                      <span>{mes.msgTime}</span>
              </div>
                  )}
                </>
              )
            )}
          </div>
          <div className="footer flex w-full absolute bottom-0 h-11 border-1 border-gray-200 bg-gray-200 rounded pl-3">
            <div
              className={`${
                emojiStatus ? "absolute" : "hidden"
              } top-[-350px] right-5`}
            >
              <EmojiPicker
                width={350}
                height={350}
                onEmojiClick={(e) =>
                  setMessage((prevData) => `${prevData}${e.emoji}`)
                }
              />
            </div>
            <div className="write flex items-center w-[calc(100%-48px)]   h-full">
              <label
                className={`${messageStatus === "file" ? "hidden" : null} active:text-sky-500 cursor-pointer text-gray-400`}
                htmlFor="select-image"
              >
                <i className="fa-solid fa-camera text-2xl"></i>
              </label>
              <input
                onChange={getFile}
                className={`${messageStatus !== "file" ? "hidden" : null} text-2xl h-full border-none outline-none bg-transparent pl-3 w-[calc(100%-85px)`}
                id="select-image"
                type="file"
                accept="image/*, audio/*"
              />
              <input
                value={message}
                onChange={(e) => setMessage(e.currentTarget.value)}
                className={`${messageStatus === "file" ? "hidden" : null} text-2xl h-full border-none outline-none bg-transparent pl-3 w-[calc(100%-85px)]`}
                placeholder="Text message"
                type="text"
              />
              <button
                onClick={(e) => setEmojiStatus(!emojiStatus)}
                className={`${messageStatus === "file" ? "hidden" : null} ml-2 ${
                  emojiStatus ? "text-sky-500" : "text-gray-400"
                }`}
              >
                <i className="fa-regular fa-face-smile text-2xl"></i>
              </button>
            </div>
            <button
              onClick={sendMessage}
              className="rounded ml-2 px-4 text-white  bg-sky-500 active:bg-cyan-950 duration-100"
            >
              <i className="fa-regular fa-paper-plane"></i>
            </button>
          </div>
          </>
        ):(
            <div className="bg-gray-100 h-full flex justify-center items-center w-full">
                <h1 className="text-3xl text-[#1c3738]">No Chat Selected</h1>
            </div>
        )}
        </div>
      </div>
      <ToastContainer />
    </>
  );
};

export default Chats;
