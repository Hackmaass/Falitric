import React from "react";

const NeoInput = ({ label, id, ...props }) => (
  <div className="form-group">
    {label && <label htmlFor={id}>{label}</label>}
    <input id={id} className="neo-input" {...props} />
  </div>
);

export default NeoInput;
